import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { callInspectaBike, getBaseUrl } from "../_shared/inspectabike.ts";

/**
 * Pushes portal-side changes for one issue back to InspectaBike so the mechanic
 * sees approvals, declines and parts progress without leaving their own app.
 *
 * Callable by internal staff (JWT). Sends only issues that carry an
 * external_fault_id, i.e. faults that originated in InspectaBike.
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const { data: isStaff } = await admin.rpc("is_internal_staff", { _user_id: user.id });
    if (!isStaff) {
      console.error("inspectabike-push-status: forbidden");
      return json({ error: "Forbidden" }, 403);
    }

    if (!getBaseUrl()) {
      return json({ error: "InspectaBike integration is not configured" }, 500);
    }

    const body = await req.json().catch(() => null);
    const issueIds: string[] = Array.isArray(body?.issue_ids)
      ? body.issue_ids.filter((v: unknown) => typeof v === "string")
      : typeof body?.issue_id === "string"
      ? [body.issue_id]
      : [];

    if (issueIds.length === 0) {
      return json({ error: "issue_id or issue_ids is required" }, 400);
    }

    const { data: issues, error: issuesError } = await admin
      .from("inspection_issues")
      .select(
        "id, inspection_id, status, customer_response, customer_responded_at, parts_ordered, parts_ordered_at, parts_arrived, parts_arrived_at, parts_cost, labour_cost, external_fault_id",
      )
      .in("id", issueIds)
      .not("external_fault_id", "is", null);
    if (issuesError) throw issuesError;

    const linked = issues ?? [];
    if (linked.length === 0) {
      return json({ ok: true, pushed: 0, reason: "no InspectaBike-linked issues" });
    }

    const inspectionIds = Array.from(new Set(linked.map((i) => i.inspection_id)));
    const { data: inspections } = await admin
      .from("bicycle_inspections")
      .select("id, external_inspection_id")
      .in("id", inspectionIds);
    const externalByInspection = new Map<string, string | null>();
    (inspections ?? []).forEach((i: any) => externalByInspection.set(i.id, i.external_inspection_id));

    const push = async () => {
      for (const issue of linked) {
        const payload = {
          external_inspection_id: externalByInspection.get(issue.inspection_id) ?? null,
          courier_issue_id: issue.id,
          fault_id: issue.external_fault_id,
          status: issue.status,
          customer_response: issue.customer_response,
          customer_responded_at: issue.customer_responded_at,
          parts_ordered: issue.parts_ordered,
          parts_ordered_at: issue.parts_ordered_at,
          parts_arrived: issue.parts_arrived,
          parts_arrived_at: issue.parts_arrived_at,
          parts_cost: issue.parts_cost,
          labour_cost: issue.labour_cost,
        };

        const result = await callInspectaBike("courier-fault-status", payload);
        if (result.ok) {
          await admin
            .from("inspection_issues")
            .update({ external_synced_at: new Date().toISOString() })
            .eq("id", issue.id);
        } else {
          console.error(`inspectabike-push-status: push failed [${result.status}]`);
        }
      }
    };

    // Keep the caller responsive; delivery continues in the background.
    // @ts-ignore EdgeRuntime is provided by the Supabase runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(push());
    } else {
      await push();
    }

    return json({ ok: true, pushed: linked.length });
  } catch (error) {
    console.error("inspectabike-push-status error:", error instanceof Error ? error.message : "unknown");
    return json({ error: "Failed to push status" }, 500);
  }
});
