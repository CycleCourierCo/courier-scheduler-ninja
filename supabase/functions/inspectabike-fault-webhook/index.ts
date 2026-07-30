import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  calculateLabourPrice,
  getSyncSecret,
  loadWorkshopRates,
  SYSTEM_ACTOR_ID,
  verifySignature,
} from "../_shared/inspectabike.ts";

/**
 * Inbound webhook: InspectaBike pushes fault lifecycle events for inspections
 * that are linked to a courier order.
 *
 * The portal is the pricing authority: labour is always recalculated from
 * labour_times + workshop_settings using the shared repair_id. Any inbound
 * labour price is ignored. Faults with no repair_id land unpriced for manual
 * pricing, exactly as a manually added issue would.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const secret = getSyncSecret();
    if (!secret) {
      console.error("inspectabike-fault-webhook: sync secret not configured");
      return json({ error: "Integration not configured" }, 500);
    }

    const rawBody = await req.text();
    const signature =
      req.headers.get("x-inspectabike-signature") ?? req.headers.get("x-signature");

    if (!(await verifySignature(rawBody, signature, secret))) {
      console.error("inspectabike-fault-webhook: invalid signature");
      return json({ error: "Invalid signature" }, 401);
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const event = typeof body?.event === "string" ? body.event : "fault.updated";
    const fault = body?.fault ?? {};
    const externalFaultId = fault?.id ? String(fault.id) : null;
    const externalInspectionId = body?.external_inspection_id
      ? String(body.external_inspection_id)
      : null;
    const courierOrderId = typeof body?.courier_order_id === "string" ? body.courier_order_id : null;

    if (!externalFaultId) {
      return json({ error: "fault.id is required" }, 400);
    }
    if (!externalInspectionId && !courierOrderId) {
      return json({ error: "external_inspection_id or courier_order_id is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // --- Resolve the local inspection ---
    let query = admin
      .from("bicycle_inspections")
      .select("id, order_id, status")
      .limit(1);
    query = externalInspectionId
      ? query.eq("external_inspection_id", externalInspectionId)
      : query.eq("order_id", courierOrderId!);

    const { data: inspections, error: insError } = await query;
    if (insError) throw insError;
    const inspection = inspections?.[0];
    if (!inspection) {
      console.error("inspectabike-fault-webhook: no linked inspection found");
      return json({ error: "No linked inspection for this fault" }, 404);
    }

    // --- Deletion ---
    const { data: existing } = await admin
      .from("inspection_issues")
      .select("id, status, labour_cost, parts_cost")
      .eq("external_fault_id", externalFaultId)
      .maybeSingle();

    if (event === "fault.deleted") {
      if (existing && ["pending", "declined"].includes(existing.status)) {
        await admin.from("inspection_issues").delete().eq("id", existing.id);
        return json({ ok: true, action: "deleted" });
      }
      return json({ ok: true, action: "ignored", reason: "issue already progressed" });
    }

    // --- Pricing (portal is the authority) ---
    const repairId = fault?.repair_id ? String(fault.repair_id) : null;
    let labourCost: number | null = null;
    let repairName: string | null = null;

    if (repairId) {
      const rates = await loadWorkshopRates(admin);
      const { data: labour } = await admin
        .from("labour_times")
        .select("repair_name, labour_minutes, min_charge_gbp")
        .eq("repair_id", repairId)
        .maybeSingle();

      if (labour) {
        repairName = labour.repair_name ?? null;
        labourCost = calculateLabourPrice(
          Number(labour.labour_minutes),
          rates.hourlyRate,
          Number(labour.min_charge_gbp) || rates.minCharge,
        );
      }
    }

    const description =
      [repairName, typeof fault?.description === "string" ? fault.description.trim() : ""]
        .filter(Boolean)
        .join(" — ") || "Fault reported in InspectaBike";

    const mechanicName = typeof fault?.mechanic_name === "string" && fault.mechanic_name.trim()
      ? fault.mechanic_name.trim()
      : "InspectaBike";

    const partsCostRaw = Number(fault?.parts_cost);
    const partsCost = Number.isFinite(partsCostRaw) && partsCostRaw >= 0 ? partsCostRaw : null;

    const nowIso = new Date().toISOString();

    const base: Record<string, unknown> = {
      inspection_id: inspection.id,
      order_id: inspection.order_id,
      issue_description: description,
      repair_id: repairId,
      part_name: fault?.part_name ?? null,
      part_number: fault?.part_number ?? null,
      part_spec: fault?.part_spec ?? null,
      parts_cost: partsCost,
      labour_cost: labourCost,
      external_fault_id: externalFaultId,
      external_synced_at: nowIso,
      updated_at: nowIso,
    };

    if (labourCost !== null) {
      base.priced_at = nowIso;
      base.priced_by_name = "InspectaBike (auto-priced from labour catalogue)";
    }

    if (!existing) {
      const { data: inserted, error: insertError } = await admin
        .from("inspection_issues")
        .insert({
          ...base,
          status: "pending",
          requested_by_id: SYSTEM_ACTOR_ID,
          requested_by_name: `InspectaBike — ${mechanicName}`,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      // Reported faults mean the bike needs pricing/approval before repair.
      if (inspection.status === "pending" || inspection.status === "inspected") {
        await admin
          .from("bicycle_inspections")
          .update({ status: "awaiting_pricing", updated_at: nowIso })
          .eq("id", inspection.id);
      }

      return json({ ok: true, action: "created", issue_id: inserted.id });
    }

    // --- Update existing issue ---
    const update: Record<string, unknown> = { ...base };

    // Never overwrite a customer decision from the workshop side.
    delete update.status;

    // Preserve manually entered pricing when the fault has no catalogue repair.
    if (labourCost === null) delete update.labour_cost;
    if (partsCost === null) delete update.parts_cost;

    if (event === "fault.repaired" && !["resolved", "repaired"].includes(existing.status)) {
      update.status = "repaired";
      update.resolved_at = fault?.repaired_at ?? nowIso;
      update.resolved_by_name = mechanicName;
    }

    const { error: updateError } = await admin
      .from("inspection_issues")
      .update(update)
      .eq("id", existing.id);
    if (updateError) throw updateError;

    return json({ ok: true, action: "updated", issue_id: existing.id });
  } catch (error) {
    console.error(
      "inspectabike-fault-webhook error:",
      error instanceof Error ? error.message : "unknown",
    );
    return json({ error: "Failed to process fault event" }, 500);
  }
});
