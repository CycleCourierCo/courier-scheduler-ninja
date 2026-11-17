// Sends the invoice_payment_reminder WhatsApp template for one overdue QuickBooks invoice.
// Admin / CS only. Phone defaults to the customer account linked by QuickBooks customer id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { identifyCaller } from "../_shared/staffAuth.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const money = (n: number) => `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ukToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const toE164 = (p: string) => {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "44" + d.slice(1);
  return d.length >= 10 && d.length <= 15 ? `+${d}` : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const caller = await identifyCaller(req);
    if (!caller) return json({ error: "Unauthorized" }, 401);
    if (caller.kind === "user" && !caller.roles.some((r) => ["admin", "cs_agent"].includes(r))) {
      return json({ error: "Admin or customer service access required" }, 403);
    }
    const body = await req.json().catch(() => ({}));
    const invoiceId = String(body?.invoiceId || "");
    if (!/^[0-9A-Za-z_-]{1,40}$/.test(invoiceId)) return json({ error: "Invalid invoice" }, 400);
    const send = body?.send === true;

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: inv } = await db.from("quickbooks_invoice_status")
      .select("quickbooks_invoice_id, doc_number, customer_name, qb_customer_id, due_date, balance, deleted")
      .eq("quickbooks_invoice_id", invoiceId).maybeSingle();
    if (!inv || inv.deleted) return json({ error: "Invoice not found" }, 404);
    const today = ukToday();
    const overdueDays = inv.due_date ? daysBetween(String(inv.due_date).slice(0, 10), today) : 0;
    if (!(Number(inv.balance) > 0) || overdueDays < 1) return json({ error: "This invoice is not overdue" }, 400);

    let profile: { name?: string | null; company_name?: string | null; phone?: string | null } | null = null;
    if (inv.qb_customer_id) {
      const { data } = await db.from("profiles").select("name, company_name, phone")
        .eq("quickbooks_customer_id", inv.qb_customer_id).not("phone", "is", null).limit(1).maybeSingle();
      profile = data;
    }
    const params = {
      customer_name: (profile?.name || inv.customer_name || "there").split(" ")[0] || "there",
      invoice_number: String(inv.doc_number || inv.quickbooks_invoice_id),
      amount_due: money(Number(inv.balance)),
      due_date: new Date(`${String(inv.due_date).slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }),
      days_overdue: String(overdueDays),
    };
    const preview = `Hi ${params.customer_name}, this is a friendly reminder from Cycle Courier Co regarding invoice #${params.invoice_number} for ${params.amount_due}, which was due on ${params.due_date} (${params.days_overdue} days overdue). Please arrange payment at your earliest convenience, or reply to this message if you have any questions. Thank you.`;

    if (!send) return json({ phone: profile?.phone || "", preview, params });

    const phone = toE164(typeof body?.phone === "string" && body.phone.trim() ? body.phone : profile?.phone || "");
    if (!phone) return json({ error: "No valid phone number for this customer" }, 400);
    const KEY = Deno.env.get("SENDZEN_API_KEY");
    if (!KEY) return json({ error: "WhatsApp service not configured" }, 500);
    const r = await fetch("https://api.sendzen.io/v1/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: phone, from: "441217980767", type: "template",
        template: {
          name: "invoice_payment_reminder", lang_code: "en_GB",
          components: [{ type: "body", parameters: Object.entries(params).map(([k, v]) => ({ type: "text", parameter_name: k, text: v })) }],
        },
      }),
    });
    const text = await r.text();
    if (!r.ok) {
      console.error(`Invoice chaser failed [${r.status}]`);
      return json({ error: "WhatsApp send failed. Check the template is approved in the WhatsApp Centre.", status: r.status, details: text.slice(0, 300) }, 502);
    }
    return json({ ok: true });
  } catch (_e) {
    console.error("send-invoice-chaser error");
    return json({ error: "Something went wrong" }, 500);
  }
});
