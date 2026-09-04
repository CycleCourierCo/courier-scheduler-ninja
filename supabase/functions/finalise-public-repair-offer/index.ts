// Public endpoint hit right after the receiver approves repairs on /repair-offer/:id.
// It (1) emails the receiver a confirmation of exactly what they approved, then
// (2) raises the receiver-billed QuickBooks invoice for that bike and emails the
// pay link + PDF — the same outcome as the staff-side button.
//
// Safe by design: it only ever acts on issues that are already approved, billed to the
// receiver and not yet invoiced, so a hostile caller can trigger nothing extra.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { trackResend } from "../_shared/integrationLog.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ADMIN_EMAIL = "Info@cyclecourierco.com";
const FROM = "CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>";

interface Issue {
  id: string;
  inspection_id: string | null;
  issue_description: string | null;
  estimated_cost: number | null;
  receiver_confirmation_sent_at: string | null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildConfirmationEmail(
  order: { tracking_number?: string | null; id: string; bike_brand?: string | null; bike_model?: string | null; receiver?: unknown },
  issues: Issue[]
): { subject: string; html: string; text: string } {
  const receiver = (order.receiver ?? {}) as { name?: string };
  const name = receiver.name || "there";
  const tracking = order.tracking_number || order.id;
  const bike = `${order.bike_brand || ""} ${order.bike_model || ""}`.trim() || "your bike";
  const total = issues.reduce((sum, it) => sum + Number(it.estimated_cost || 0), 0);
  const plural = issues.length === 1 ? "repair" : "repairs";

  const rows = issues
    .map(
      (it) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(it.issue_description || "Repair")}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e5e5;text-align:right;white-space:nowrap;">£${Number(it.estimated_cost || 0).toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Thanks ${escapeHtml(name)} — your ${plural} ${issues.length === 1 ? "is" : "are"} confirmed</h2>
      <p>We've received your approval for the following work on ${escapeHtml(bike)} (CCC ${escapeHtml(tracking)}):</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #333;">Repair</th>
            <th style="text-align:right;padding:8px;border-bottom:2px solid #333;">Price</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td style="padding:8px;font-weight:bold;">Total (including VAT)</td>
            <td style="padding:8px;text-align:right;font-weight:bold;">£${total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <p>${issues.length === 1 ? "This repair is" : "These repairs are"} paid by you directly to Cycle Courier Co. A separate email with your invoice, a payment link and a PDF copy will follow shortly.</p>
      <p>If anything above looks wrong, reply to this email straight away.</p>
      <p>Thank you,<br>CCC - Cycle Courier Co.</p>
    </div>
  `;

  const lines = issues
    .map((it) => `- ${it.issue_description || "Repair"}: £${Number(it.estimated_cost || 0).toFixed(2)}`)
    .join("\n");

  const text = `Thanks ${name} — your ${plural} ${issues.length === 1 ? "is" : "are"} confirmed.

We've received your approval for the following work on ${bike} (CCC ${tracking}):

${lines}

Total (including VAT): £${total.toFixed(2)}

${issues.length === 1 ? "This repair is" : "These repairs are"} paid by you directly to Cycle Courier Co. A separate email with your invoice, a payment link and a PDF copy will follow shortly.

If anything above looks wrong, reply to this email straight away.

Thank you,
CCC - Cycle Courier Co.`;

  return {
    subject: `Repairs confirmed — CCC ${tracking}`,
    html,
    text,
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const orderId = (body as { orderId?: string })?.orderId;
    if (!orderId || !UUID_RE.test(orderId)) {
      return json({ error: "A valid orderId is required" }, 400);
    }

    const { data: issuesData, error: issuesError } = await supabase
      .from("inspection_issues")
      .select("id, inspection_id, issue_description, estimated_cost, receiver_confirmation_sent_at")
      .eq("order_id", orderId)
      .eq("billing_party", "receiver")
      .is("invoice_number", null)
      .not("receiver_approved_at", "is", null);

    if (issuesError) {
      console.error("Failed to load receiver-approved issues:", issuesError.message);
      return json({ error: "Could not load approved repairs" }, 500);
    }

    const issues = (issuesData ?? []) as Issue[];

    // One invoice per bike: group by inspection and invoice each inspection once.
    const inspectionIds = Array.from(
      new Set(issues.map((i) => i.inspection_id).filter((id): id is string => !!id))
    );
    if (inspectionIds.length === 0) {
      return json({ success: true, invoiced: 0, confirmed: 0 });
    }

    const { data: order } = await supabase
      .from("orders")
      .select("id, tracking_number, bike_brand, bike_model, receiver")
      .eq("id", orderId)
      .maybeSingle();

    const receiverEmail = (order?.receiver as { email?: string } | null)?.email || null;

    const resend = resendApiKey
      ? trackResend(new Resend(resendApiKey), "receiver repair confirmation")
      : null;

    // 1. Confirmation email per bike — never depends on QuickBooks, so it always lands.
    let confirmed = 0;
    if (resend && order && receiverEmail) {
      for (const inspectionId of inspectionIds) {
        const bikeIssues = issues.filter(
          (i) => i.inspection_id === inspectionId && !i.receiver_confirmation_sent_at
        );
        if (bikeIssues.length === 0) continue;
        try {
          const email = buildConfirmationEmail(order, bikeIssues);
          await resend.emails.send({
            from: FROM,
            to: [receiverEmail],
            reply_to: ADMIN_EMAIL,
            subject: email.subject,
            html: email.html,
            text: email.text,
          });
          await supabase
            .from("inspection_issues")
            .update({ receiver_confirmation_sent_at: new Date().toISOString() })
            .in("id", bikeIssues.map((i) => i.id));
          confirmed += bikeIssues.length;
        } catch (err) {
          console.error("Failed to send receiver repair confirmation:", (err as Error)?.message);
        }
      }
    } else if (!receiverEmail) {
      console.warn("No receiver email on order; skipping repair confirmation email");
    } else if (!resend) {
      console.warn("RESEND_API_KEY not set; skipping repair confirmation email");
    }

    if (!cronSecret) {
      console.error("CRON_SECRET is not configured; cannot raise receiver invoices automatically");
      return json({ success: true, invoiced: 0, confirmed, warning: "invoicing_unavailable" });
    }

    const notifyAdminOfFailure = async (inspectionId: string, detail: string) => {
      if (!resend) return;
      const tracking = order?.tracking_number || orderId;
      try {
        await resend.emails.send({
          from: FROM,
          to: [ADMIN_EMAIL],
          reply_to: ADMIN_EMAIL,
          subject: `Action needed: receiver approved repairs but no invoice was raised — CCC ${tracking}`,
          html: `<div style="font-family: Arial, sans-serif;">
            <p>The receiver approved repairs on <strong>CCC ${escapeHtml(tracking)}</strong> and has been sent a confirmation email, but the QuickBooks invoice could not be raised automatically.</p>
            <p>Please raise it manually from the inspection card.</p>
            <p>Inspection: ${escapeHtml(inspectionId)}<br>Reason: ${escapeHtml(detail)}</p>
          </div>`,
          text: `The receiver approved repairs on CCC ${tracking} and has been sent a confirmation email, but the QuickBooks invoice could not be raised automatically.\n\nPlease raise it manually from the inspection card.\n\nInspection: ${inspectionId}\nReason: ${detail}`,
        });
      } catch (err) {
        console.error("Failed to send admin invoice-failure alert:", (err as Error)?.message);
      }
    };

    // 2. Invoice in the background so the receiver's page confirms instantly.
    const work = (async () => {
      for (const inspectionId of inspectionIds) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/create-receiver-inspection-invoice`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Cron-Secret": cronSecret,
              apikey: serviceKey,
            },
            body: JSON.stringify({ inspectionId }),
          });
          if (!res.ok) {
            const text = await res.text();
            console.error(
              `Receiver invoice failed for inspection ${inspectionId} [${res.status}]`
            );
            await notifyAdminOfFailure(inspectionId, `${res.status} ${text.slice(0, 200)}`);
          }
        } catch (err) {
          console.error(
            `Receiver invoice threw for inspection ${inspectionId}:`,
            (err as Error)?.message
          );
          await notifyAdminOfFailure(inspectionId, (err as Error)?.message || "unknown error");
        }
      }
    })();

    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) {
      runtime.waitUntil(work);
    } else {
      await work;
    }

    return json({ success: true, invoiced: inspectionIds.length, confirmed });
  } catch (err) {
    console.error("finalise-public-repair-offer error:", (err as Error)?.message);
    return json({ error: "Unexpected error" }, 500);
  }
};

serve(handler);
