import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { captureException, initSentry, startSpan } from "../_shared/sentry.ts";

initSentry("public-inspection-approval");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    const body = await req.json().catch(() => ({}));
    const inspectionId = typeof body?.inspectionId === "string" ? body.inspectionId.trim() : "";
    if (!UUID.test(inspectionId)) return json({ error: "A valid inspection is required" }, 400);

    return await startSpan("inspection.approval", req.method === "POST" ? "Submit inspection approval" : "Get inspection approval", async () => {
      if (req.method === "POST") {
        const approvedIssueIds = Array.isArray(body?.approvedIssueIds)
          ? body.approvedIssueIds.filter((value: unknown) => typeof value === "string" && UUID.test(value))
          : [];
        const serviceDecision = body?.serviceDecision === "accepted" || body?.serviceDecision === "declined"
          ? body.serviceDecision
          : null;
        const { data, error } = await admin.rpc("submit_inspection_approval_internal", {
          p_inspection_id: inspectionId,
          p_approved_issue_ids: approvedIssueIds,
          p_service_decision: serviceDecision,
        });
        if (error) throw error;
        return json(data ?? { success: false });
      }

      const { data, error } = await admin.rpc("get_public_inspection_approval", { p_inspection_id: inspectionId });
      if (error) throw error;
      return json(data ?? { found: false });
    });
  } catch (error) {
    captureException(error instanceof Error ? error : new Error("Unknown approval error"), { function: "public-inspection-approval" });
    return json({ error: "The approval request could not be processed" }, 500);
  }
});