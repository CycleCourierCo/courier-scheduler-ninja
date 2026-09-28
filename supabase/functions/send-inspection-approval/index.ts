import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/cors.ts";
import { regenerateInspectionReport } from "../_shared/inspectionReport.ts";
import { trackResend } from "../_shared/integrationLog.ts";
import { toPublicFileUrl } from "../_shared/publicFileUrl.ts";

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

async function fetchServicePrice(admin: any, userId: string): Promise<number | null> {
  const { data: token } = await admin
    .from("quickbooks_tokens")
    .select("access_token, refresh_token, company_id, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!token?.access_token || !token?.company_id) return null;
  let accessToken = token.access_token;
  if (new Date(token.expires_at).getTime() - Date.now() < 300000) {
    const clientId = Deno.env.get("QUICKBOOKS_CLIENT_ID");
    const clientSecret = Deno.env.get("QUICKBOOKS_CLIENT_SECRET");
    if (!clientId || !clientSecret || !token.refresh_token) return null;
    const refreshed = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: token.refresh_token }),
    });
    if (!refreshed.ok) return null;
    const credentials = await refreshed.json();
    accessToken = credentials.access_token;
    const { error: tokenError } = await admin.from("quickbooks_tokens").update({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || token.refresh_token,
      expires_at: new Date(Date.now() + credentials.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    if (tokenError) return null;
  }
  const query = "SELECT * FROM Item WHERE Name = 'Bike Inspection & Service' AND Active = true";
  const response = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${token.company_id}/query?query=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
  );
  if (!response.ok) return null;
  const payload = await response.json();
  const price = Number(payload?.QueryResponse?.Item?.[0]?.UnitPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
}

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
    const requestedRecipient = typeof body?.recipient === "string" ? body.recipient.trim() : "";
    if (!UUID.test(inspectionId)) {
      return json({ error: "A valid inspectionId is required" }, 400);
    }

    const { data: inspection, error: inspError } = await admin
      .from("bicycle_inspections")
      .select(
        "id, order_id, status, released_to_customer_at, approval_email_sent_at, report_url, created_at, approval_recipient, customer_name, customer_email, bike_brand, bike_model, reference, inspection_type, service_decision"
      )
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

    const workshopOnly = !inspection.order_id;

    let order: any = null;
    if (!workshopOnly) {
      const { data: orderRow, error: orderError } = await admin
        .from("orders")
        .select("id, tracking_number, bike_brand, bike_model, user_id, sender, receiver")
        .eq("id", inspection.order_id)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!orderRow) return json({ error: "Order not found" }, 404);
      order = orderRow;
    }

    // Who is being asked to approve: the booking account, the sender contact on
    // the order, the receiver/buyer, or the walk-in customer on a
    // workshop-only inspection.
    const allowedRecipients = ["customer", "sender", "receiver", "walkin"];
    let recipient = allowedRecipients.includes(requestedRecipient)
      ? requestedRecipient
      : (allowedRecipients.includes(String(inspection.approval_recipient))
          ? String(inspection.approval_recipient)
          : (workshopOnly ? "walkin" : "customer"));
    if (workshopOnly) recipient = "walkin";

    const { data: issues, error: issuesError } = await admin
      .from("inspection_issues")
      .select("id, issue_description, estimated_cost, parts_cost, labour_cost, status")
      .eq("inspection_id", inspectionId)
      .order("created_at", { ascending: true });
    if (issuesError) throw issuesError;

    const pending = (issues || []).filter((i: any) => (i.status || "pending") === "pending");
    const serviceChoicePending = inspection.inspection_type === "inspection_only" && inspection.service_decision === "pending";
    if (pending.length === 0 && !serviceChoicePending && !force) {
      return json({ success: true, skipped: "nothing_awaiting_approval" });
    }

    let servicePrice: number | null = null;
    if (serviceChoicePending) {
      servicePrice = await fetchServicePrice(admin, user.id);
      if (servicePrice == null) {
        const { data: connected } = await admin.from("quickbooks_tokens")
          .select("user_id").neq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        if (connected?.user_id) servicePrice = await fetchServicePrice(admin, connected.user_id);
      }
      if (servicePrice == null) return json({ error: "Bike Inspection & Service price is unavailable in QuickBooks" }, 400);
      const { error: priceError } = await admin
        .from("bicycle_inspections")
        .update({ service_price_gbp: servicePrice })
        .eq("id", inspectionId);
      if (priceError) throw priceError;
    }

    // Always refresh the report so the link matches the current state.
    let reportUrl = toPublicFileUrl(inspection.report_url as string | null);
    try {
      const regenerated = await regenerateInspectionReport(admin, inspectionId);
      reportUrl = toPublicFileUrl(regenerated.url) || reportUrl;
    } catch (err) {
      console.error("Report regeneration failed before approval email:", err instanceof Error ? err.message : "unknown");
    }

    // Legacy inspections (created before the cutoff) don't get a customer-facing report link.
    const REPORT_CUTOFF = Date.parse("2026-08-25T00:00:00+01:00");
    const createdAt = inspection.created_at ? Date.parse(inspection.created_at as string) : 0;
    if (!(createdAt >= REPORT_CUTOFF)) {
      reportUrl = null;
    }

    // Booking account (not the receiver).
    let profile: any = null;
    if (order?.user_id) {
      const { data: profileRow } = await admin
        .from("profiles")
        .select("id, name, email, accounts_email, is_test_account")
        .eq("id", order.user_id)
        .maybeSingle();
      profile = profileRow;
    }

    let to = "";
    let greetName = "there";
    if (recipient === "customer") {
      to = (profile?.accounts_email || profile?.email || "").trim();
      greetName = profile?.name || "there";
      if (!to) return json({ error: "The booking account has no email address" }, 400);
    } else if (recipient === "sender") {
      to = String((order?.sender as any)?.email || "").trim();
      greetName = String((order?.sender as any)?.name || "there");
      if (!to) return json({ error: "This job has no sender email address" }, 400);
    } else if (recipient === "receiver") {
      to = String((order?.receiver as any)?.email || "").trim();
      greetName = String((order?.receiver as any)?.name || "there");
      if (!to) return json({ error: "This job has no receiver email address" }, 400);
    } else {
      to = String(inspection.customer_email || "").trim();
      greetName = String(inspection.customer_name || "there");
      if (!to) return json({ error: "This inspection has no customer email address" }, 400);
    }

    if (profile?.is_test_account === true) {
      return json({ success: true, skipped: "test_account" });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "Email is not configured" }, 500);

    const bike =
      [order?.bike_brand ?? inspection.bike_brand, order?.bike_model ?? inspection.bike_model]
        .filter(Boolean)
        .join(" ") || "the bike";
    const jobRef = order?.tracking_number || inspection.reference || "";
    const total = pending.reduce((s: number, i: any) => s + Number(i.estimated_cost || 0), 0);
    // Booking accounts approve inside the portal; receivers and walk-ins get a
    // public link that needs no login.
    const link =
      recipient === "customer" && !serviceChoicePending
        ? `${BASE_URL}/customer-orders/${order.id}`
        : `${BASE_URL}/inspection-approval/${inspection.id}`;

    const rows = pending
      .map((i: any) => {
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${esc(i.issue_description)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right"><strong>${money(Number(i.estimated_cost || 0))}</strong></td>
        </tr>`;
      })
      .join("");


    const refLine = jobRef ? ` (job #${esc(jobRef)})` : "";
    const payerNote =
      recipient === "customer"
        ? "The bike stays with us until you let us know how you'd like to proceed, so the sooner you approve or decline, the sooner we can get it moving."
        : "Anything you approve is paid by you directly, and we'll be in touch about payment. The bike stays with us until you let us know how you'd like to proceed.";

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;line-height:1.5">
        <p>Hi ${esc(greetName)},</p>
         <p>Our workshop has finished inspecting <strong>${esc(bike)}</strong>${refLine}. ${pending.length > 0 ? `We found ${pending.length} item${pending.length === 1 ? "" : "s"} that need${pending.length === 1 ? "s" : ""} your approval.` : "No repair faults were found."}${serviceChoicePending ? " You can also choose whether to add a full service." : ""}</p>
         ${serviceChoicePending ? `<p>Optional full service: <strong>${money(servicePrice ?? 0)}</strong>. You can accept or decline this separately from any repairs.</p>` : ""}
         ${pending.length > 0 ? `<table style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0">
          <thead>
            <tr style="background:#f1f5f9">
              <th style="padding:8px;text-align:left">Work needed</th>
              <th style="padding:8px;text-align:right">Price</th>

            </tr>
          </thead>
          <tbody>${rows}</tbody>
         </table>
         <p>Total if all repairs are approved: <strong>${money(total)}</strong></p>` : ""}
        <p style="margin:20px 0"><a href="${link}" style="background:#0f766e;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">Review workshop options</a></p>
        ${reportUrl ? `<p style="font-size:14px"><a href="${esc(reportUrl)}">View the full inspection report (PDF)</a></p>` : ""}
        <p style="font-size:13px;color:#4b5563">${payerNote}</p>
        <p style="font-size:13px;color:#4b5563">Thanks,<br/>CCC - Cycle Courier Co.</p>
      </div>`;

    const resend = trackResend(new Resend(resendKey), "inspection approval");
    const { error: emailError } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject: jobRef ? `Workshop choices — job #${jobRef}` : `Workshop choices — ${bike}`,
      html,
      reply_to: REPLY_TO,
    });
    if (emailError) {
      console.error("Inspection approval email failed:", emailError.message);
      return json({ error: "Failed to send the approval email" }, 502);
    }

    await admin
      .from("bicycle_inspections")
      .update({
        approval_email_sent_at: new Date().toISOString(),
        approval_recipient: recipient,
        approval_sent_to_at: new Date().toISOString(),
      })
      .eq("id", inspectionId);

    return json({ success: true, issues: pending.length, reportUrl, recipient });
  } catch (error) {
    console.error("send-inspection-approval failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Failed to send the approval email" }, 500);
  }
});
