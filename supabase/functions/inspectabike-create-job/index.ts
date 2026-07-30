import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { callInspectaBike, EXTERNAL_PROVIDER, getBaseUrl } from "../_shared/inspectabike.ts";

/**
 * Creates (or returns) the linked InspectaBike inspection for a courier order.
 * Idempotent: if the order's inspection already carries an external id, it is returned as-is.
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // --- Auth: internal staff only (admin / mechanic / route_planner) ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    let allowed = false;
    for (const role of ["admin", "mechanic", "route_planner"]) {
      const { data: ok } = await admin.rpc("has_role", { _user_id: user.id, _role: role });
      if (ok) {
        allowed = true;
        break;
      }
    }
    if (!allowed) {
      console.error("inspectabike-create-job: forbidden role");
      return json({ error: "Forbidden" }, 403);
    }

    if (!getBaseUrl()) {
      return json({ error: "InspectaBike integration is not configured" }, 500);
    }

    // --- Input ---
    const body = await req.json().catch(() => null);
    const orderId = typeof body?.order_id === "string" ? body.order_id : null;
    const bikeIndexRaw = Number(body?.bike_index ?? 0);
    const bikeIndex = Number.isFinite(bikeIndexRaw) && bikeIndexRaw >= 0 ? Math.floor(bikeIndexRaw) : 0;
    if (!orderId) {
      return json({ error: "order_id is required" }, 400);
    }

    // --- Order + bike snapshot (bikes JSONB is the source of truth) ---
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, tracking_number, bike_brand, bike_model, bikes, sender, receiver, needs_inspection")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return json({ error: "Order not found" }, 404);

    const bikes = Array.isArray(order.bikes) ? order.bikes : [];
    const bike = bikes[bikeIndex] ?? {};

    // --- Ensure a local inspection row exists ---
    let { data: inspection, error: insError } = await admin
      .from("bicycle_inspections")
      .select("id, bike_type, external_inspection_id, external_report_url, external_sent_at")
      .eq("order_id", orderId)
      .maybeSingle();
    if (insError) throw insError;

    if (!inspection) {
      const { data: created, error: createError } = await admin
        .from("bicycle_inspections")
        .insert({ order_id: orderId, status: "pending" })
        .select("id, bike_type, external_inspection_id, external_report_url, external_sent_at")
        .single();
      if (createError) throw createError;
      inspection = created;
    }

    // Already linked → return existing link (idempotent).
    if (inspection.external_inspection_id) {
      return json({
        already_linked: true,
        external_inspection_id: inspection.external_inspection_id,
        report_url: inspection.external_report_url,
      });
    }

    const senderName = (order.sender as any)?.name ?? null;
    const receiverName = (order.receiver as any)?.name ?? null;

    const payload = {
      courier_order_id: order.id,
      courier_tracking_number: order.tracking_number,
      courier_inspection_id: inspection.id,
      serial_number: bike?.serialNumber ?? bike?.serial_number ?? null,
      bike_make: bike?.brand ?? order.bike_brand ?? "Unknown",
      bike_model: bike?.model ?? order.bike_model ?? "Unknown",
      bike_type: inspection.bike_type ?? bike?.bikeType ?? bike?.type ?? "standard",
      bike_year: bike?.year ?? "",
      customer_name: receiverName ?? senderName ?? "Cycle Courier Co customer",
    };

    const result = await callInspectaBike("courier-create-inspection", payload);
    if (!result.ok) {
      return json(
        { error: result.error ?? "InspectaBike request failed", status: result.status, details: result.data },
        result.status === 500 ? 502 : result.status,
      );
    }

    const externalId = result.data?.inspection_id ?? result.data?.id ?? null;
    const reportUrl = result.data?.report_url ?? null;

    const { error: updateError } = await admin
      .from("bicycle_inspections")
      .update({
        external_provider: EXTERNAL_PROVIDER,
        external_inspection_id: externalId ? String(externalId) : null,
        external_report_url: reportUrl,
        external_sent_at: new Date().toISOString(),
      })
      .eq("id", inspection.id);
    if (updateError) throw updateError;

    return json({
      already_linked: false,
      external_inspection_id: externalId,
      report_url: reportUrl,
    });
  } catch (error) {
    console.error("inspectabike-create-job error:", error instanceof Error ? error.message : "unknown");
    return json({ error: "Failed to create InspectaBike job" }, 500);
  }
});
