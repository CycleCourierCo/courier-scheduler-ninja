import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { regenerateInspectionReport } from "../_shared/inspectionReport.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const inspectionId = typeof body?.inspectionId === "string" ? body.inspectionId.trim() : "";
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";

    if (!UUID.test(inspectionId) && !UUID.test(orderId)) {
      return json({ error: "A valid inspectionId or orderId is required" }, 400);
    }

    let resolvedId = UUID.test(inspectionId) ? inspectionId : "";
    if (!resolvedId) {
      const { data: insp } = await admin
        .from("bicycle_inspections")
        .select("id")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!insp?.id) return json({ error: "No inspection found for this order" }, 404);
      resolvedId = insp.id;
    }

    // Staff may regenerate at any stage; anyone else only once the inspection
    // has been released to the customer (the report is customer-facing then).
    let isStaff = false;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const { data: { user } } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
      if (user) {
        const { data: staff } = await admin.rpc("is_internal_staff", { _user_id: user.id });
        isStaff = staff === true;
      }
    }

    if (!isStaff) {
      const { data: insp } = await admin
        .from("bicycle_inspections")
        .select("released_to_customer_at")
        .eq("id", resolvedId)
        .maybeSingle();
      if (!insp?.released_to_customer_at) return json({ error: "Forbidden" }, 403);
    }

    const { url } = await regenerateInspectionReport(admin, resolvedId);
    return json({ success: true, url });
  } catch (error) {
    console.error("inspection-report failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Failed to generate inspection report" }, 500);
  }
});
