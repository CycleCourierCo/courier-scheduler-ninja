import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/cors.ts";
import { regenerateInspectionReport } from "../_shared/inspectionReport.ts";
import { trackResend } from "../_shared/integrationLog.ts";

const BASE_URL = "https://booking.cyclecourierco.com";
const FROM = "CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>";
const REPLY_TO = "Info@cyclecourierco.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const money = (n: number) => `£${Number(n || 0).toFixed(2)}`;
const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // --- Auth: internal staff only ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const { data: { user }, error: authError } = await admin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const { data: staff } = await admin.rpc("is_internal_staff", { _user_id: user.id });
    if (staff !== true) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const inspectionId = typeof body?.inspectionId === "string" ? body.inspectionId.trim() : "";
    const force = body?.force === true;
    if (!UUID.test(inspectionId)) {
      return json({ error: "A valid inspectionId is required" }, 400);
    }

    const { data: inspection, error: inspError } = await admin
      .from("bicycle_inspections")
      .select("id, order_id, status, released_to_customer_at, approval_email_sent_at, report_url")
      .eq("id", inspectionId)
      .maybeSingle();
    if (inspError) throw inspError;
    if (!inspection) return json({ error: "Inspection not found" }, 404);
    if (!inspection.released_to_customer_at) {
      return json({ error: "Inspection has not been released to the customer yet" }, 400);
    }
    if (inspection.approval_email_sent_at && !force) {
      return json({ success: true, skipped: "already_sent" });
    }

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, tracking_number, bike_brand, bike_model, user_id, sender")
      .eq("id", inspection.order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json({ error: "Order not found" }, 404);

    const { data: issues, error: issuesError } = await admin
      .from("inspection_issues")
      .select("id, issue_description, estimated_cost, parts_cost, labour_cost, status")
      .eq("inspection_id", inspectionId)
      .order("created_at", { ascending: true });
    if (issuesError) throw issuesError;

    const pending = (issues || []).filter((i: any) => (i.status || "pending") === "pending");
    if (pending.length === 0 && !force) {
      return json({ success: true, skipped: "nothing_awaiting_approval" });
    }

    // Always refresh the report so the link matches the current state.
    let reportUrl = inspection.report_url as string | null;
    try {
      const regenerated = await regenerateInspectionReport(admin, inspectionId);
      reportUrl = regenerated.url || reportUrl;
    } catch (err) {
      console.error("Report regeneration failed before approval email:", err instanceof Error ? err.message : "unknown");
    }

    // Booking account (not the receiver).
    const { data: profile } = await admin
      .from("profiles")
      .select("id, name, email, accounts_email, is_test_account")
      .eq("id", order.user_id)
      .maybeSingle();

    const to = (profile?.accounts_email || profile?.email || "").trim();
    if (!to) return json({ error: "The booking account has no email address" }, 400);

    if (profile?.is_test_account === true) {
      return json({ success: true, skipped: "test_account" });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "Email is not configured" }, 500);

    const bike = [order.bike_brand, order.bike_model].filter(Boolean).join(" ") || "the bike";
    const total = pending.reduce((s: number, i: any) => s + Number(i.estimated_cost || 0), 0);
    const link = `${BASE_URL}/bicycle-inspections`;

    const rows = pending
      .map((i: any) => {
        const parts = i.parts_cost != null ? money(Number(i.parts_cost)) : "—";
        const labour = i.labour_cost != null ? money(Number(i.labour_cost)) : "—";
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${esc(i.issue_description)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${parts}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${labour}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right"><strong>${money(Number(i.estimated_cost || 0))}</strong></td>
        </tr>`;
      })
      .join("");

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;line-height:1.5">
        <p>Hi ${esc(profile?.name || "there")},</p>
        <p>Our workshop has finished inspecting <strong>${esc(bike)}</strong> (job #${esc(order.tracking_number)}) and found ${pending.length} item${pending.length === 1 ? "" : "s"} that need${pending.length === 1 ? "s" : ""} your approval before we can carry out the work.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0">
          <thead>
            <tr style="background:#f1f5f9">
              <th style="padding:8px;text-align:left">Work needed</th>
              <th style="padding:8px;text-align:right">Parts</th>
              <th style="padding:8px;text-align:right">Labour</th>
              <th style="padding:8px;text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p>Total if all work is approved: <strong>${money(total)}</strong></p>
        <p style="margin:20px 0"><a href="${link}" style="background:#0f766e;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">Review and approve repairs</a></p>
        ${reportUrl ? `<p style="font-size:14px"><a href="${esc(reportUrl)}">View the full inspection report (PDF)</a></p>` : ""}
        <p style="font-size:13px;color:#4b5563">The bike stays with us until you let us know how you'd like to proceed, so the sooner you approve or decline, the sooner we can get it moving.</p>
        <p style="font-size:13px;color:#4b5563">Thanks,<br/>CCC - Cycle Courier Co.</p>
      </div>`;

    const resend = trackResend(new Resend(resendKey), "inspection approval");
    const { error: emailError } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject: `Repairs need approval — job #${order.tracking_number}`,
      html,
      reply_to: REPLY_TO,
    });
    if (emailError) {
      console.error("Inspection approval email failed:", emailError.message);
      return json({ error: "Failed to send the approval email" }, 502);
    }

    await admin
      .from("bicycle_inspections")
      .update({ approval_email_sent_at: new Date().toISOString() })
      .eq("id", inspectionId);

    return json({ success: true, issues: pending.length, reportUrl });
  } catch (error) {
    console.error("send-inspection-approval failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Failed to send the approval email" }, 500);
  }
});
