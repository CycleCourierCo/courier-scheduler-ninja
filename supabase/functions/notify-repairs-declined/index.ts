import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/cors.ts";
import { trackResend } from "../_shared/integrationLog.ts";

const BASE_URL = "https://booking.cyclecourierco.com";
const FROM = "CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>";
const REPLY_TO = "Info@cyclecourierco.com";
const ADMIN_TO = "Info@cyclecourierco.com";
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
    // Signed-in staff (or the service role) may trigger this notification.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    if (token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      const { data: { user }, error: authError } = await admin.auth.getUser(token);
      if (authError || !user) return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    if (!UUID.test(orderId)) return json({ error: "A valid orderId is required" }, 400);

    const { data: issues, error: issuesError } = await admin
      .from("inspection_issues")
      .select("id, issue_description, estimated_cost, status, customer_response, customer_responded_at, decline_notified_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (issuesError) throw issuesError;

    const all = issues || [];
    const fresh = all.filter(
      (i: any) => i.status === "declined" && !i.decline_notified_at
    );
    if (fresh.length === 0) {
      return json({ success: true, skipped: "nothing_new" });
    }

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, tracking_number, bike_brand, bike_model, user_id")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json({ error: "Order not found" }, 404);

    const { data: profile } = await admin
      .from("profiles")
      .select("id, name, email, is_test_account")
      .eq("id", order.user_id)
      .maybeSingle();

    if (profile?.is_test_account === true) {
      await admin
        .from("inspection_issues")
        .update({ decline_notified_at: new Date().toISOString() })
        .in("id", fresh.map((i: any) => i.id));
      return json({ success: true, skipped: "test_account" });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "Email is not configured" }, 500);

    const bike = [order.bike_brand, order.bike_model].filter(Boolean).join(" ") || "the bike";
    const stillApproved = all.filter((i: any) => i.status === "approved");
    const declinedTotal = fresh.reduce((s: number, i: any) => s + Number(i.estimated_cost || 0), 0);
    const link = `${BASE_URL}/orders/${order.id}`;

    const rows = fresh
      .map(
        (i: any) => `<tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${esc(i.issue_description)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${esc(i.customer_response || "Declined")}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${money(Number(i.estimated_cost || 0))}</td>
        </tr>`
      )
      .join("");

    const approvedHtml = stillApproved.length
      ? `<p style="margin:16px 0 4px"><strong>Still approved (${stillApproved.length}):</strong></p>
         <ul style="margin:0 0 8px;padding-left:18px">${stillApproved
           .map((i: any) => `<li>${esc(i.issue_description)} — ${money(Number(i.estimated_cost || 0))}</li>`)
           .join("")}</ul>`
      : `<p style="margin:16px 0">No repairs remain approved on this job.</p>`;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;line-height:1.5">
        <p><strong>${fresh.length} repair${fresh.length === 1 ? " has" : "s have"} been declined.</strong></p>
        <p>Job <strong>#${esc(order.tracking_number)}</strong> — ${esc(bike)}<br/>
        Customer: ${esc(profile?.name || "Unknown")}</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0">
          <thead>
            <tr style="background:#f1f5f9">
              <th style="padding:8px;text-align:left">Declined work</th>
              <th style="padding:8px;text-align:left">Response</th>
              <th style="padding:8px;text-align:right">Price</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p>Value declined: <strong>${money(declinedTotal)}</strong></p>
        ${approvedHtml}
        <p style="margin:20px 0"><a href="${link}" style="background:#0f766e;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">Open the job</a></p>
        <p style="font-size:13px;color:#4b5563">CCC - Cycle Courier Co.</p>
      </div>`;

    const resend = trackResend(new Resend(resendKey), "repairs declined notification");
    const { error: emailError } = await resend.emails.send({
      from: FROM,
      to: [ADMIN_TO],
      subject: `Repairs declined — job #${order.tracking_number}`,
      html,
      reply_to: REPLY_TO,
    });
    if (emailError) {
      console.error("Declined-repairs email failed:", emailError.message);
      return json({ error: "Failed to send the notification" }, 502);
    }

    await admin
      .from("inspection_issues")
      .update({ decline_notified_at: new Date().toISOString() })
      .in("id", fresh.map((i: any) => i.id));

    return json({ success: true, declined: fresh.length });
  } catch (error) {
    console.error("notify-repairs-declined failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Failed to send the notification" }, 500);
  }
});
