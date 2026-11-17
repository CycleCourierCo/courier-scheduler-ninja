// Sends a WhatsApp payment reminder for one overdue invoice, or all of a customer's overdue invoices.
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
    const send = body?.send === true;
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = ukToday();
    const fmtDate = (d: string) => new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
    const cols = "quickbooks_invoice_id, doc_number, customer_name, qb_customer_id, due_date, balance, deleted";

    let invoices: any[] = [];
    if (typeof body?.customerName === "string" && body.customerName.trim()) {
      const name = body.customerName.trim().slice(0, 200);
      const { data } = await db.from("quickbooks_invoice_status").select(cols)
        .eq("customer_name", name).eq("deleted", false).gt("balance", 0);
      invoices = (data || []).filter((i: any) => i.due_date && daysBetween(String(i.due_date).slice(0, 10), today) >= 1);
      if (!invoices.length) return json({ error: "This customer has no overdue invoices" }, 400);
    } else {
      const invoiceId = String(body?.invoiceId || "");
      if (!/^[0-9A-Za-z_-]{1,40}$/.test(invoiceId)) return json({ error: "Invalid invoice" }, 400);
      const { data: inv } = await db.from("quickbooks_invoice_status").select(cols).eq("quickbooks_invoice_id", invoiceId).maybeSingle();
      if (!inv || inv.deleted) return json({ error: "Invoice not found" }, 404);
      const d = inv.due_date ? daysBetween(String(inv.due_date).slice(0, 10), today) : 0;
      if (!(Number(inv.balance) > 0) || d < 1) return json({ error: "This invoice is not overdue" }, 400);
      invoices = [inv];
    }
    invoices.sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
    const inv = invoices[0];
    const overdueDays = daysBetween(String(inv.due_date).slice(0, 10), today);

    let profile: { name?: string | null; company_name?: string | null; phone?: string | null } | null = null;
    const qbId = invoices.find((i) => i.qb_customer_id)?.qb_customer_id;
    if (qbId) {
      const { data } = await db.from("profiles").select("name, company_name, phone")
        .eq("quickbooks_customer_id", qbId).not("phone", "is", null).limit(1).maybeSingle();
      profile = data;
    }
    const first = (profile?.name || inv.customer_name || "there").split(" ")[0] || "there";
    let template: string, params: Record<string, string>, preview: string;
    if (invoices.length === 1) {
      template = "invoice_payment_reminder";
      params = {
        customer_name: first,
        invoice_number: String(inv.doc_number || inv.quickbooks_invoice_id),
        amount_due: money(Number(inv.balance)),
        due_date: fmtDate(inv.due_date),
        days_overdue: String(overdueDays),
      };
      preview = `Hi ${params.customer_name}, this is a friendly reminder from Cycle Courier Co regarding invoice #${params.invoice_number} for ${params.amount_due}, which was due on ${params.due_date} (${params.days_overdue} days overdue). Please arrange payment at your earliest convenience, or reply to this message if you have any questions. Thank you.`;
    } else {
      template = "customer_account_reminder";
      const totalOwed = invoices.reduce((s, i) => s + Number(i.balance), 0);
      params = {
        customer_name: first,
        invoice_count: String(invoices.length),
        amount_due: money(totalOwed),
        invoice_numbers: invoices.map((i) => `#${i.doc_number || i.quickbooks_invoice_id}`).join(", ").slice(0, 300),
        days_overdue: String(overdueDays),
      };
      preview = `Hi ${params.customer_name}, this is a friendly reminder from Cycle Courier Co that ${params.invoice_count} invoices on your account are overdue, totalling ${params.amount_due} (${params.invoice_numbers}). The oldest is ${params.days_overdue} days overdue. Please arrange payment at your earliest convenience, or reply to this message if you have any questions. Thank you.`;
    }
    const list = invoices.map((i) => ({ number: String(i.doc_number || i.quickbooks_invoice_id), balance: Number(i.balance), due: fmtDate(i.due_date), days: daysBetween(String(i.due_date).slice(0, 10), today) }));

    if (!send) return json({ phone: profile?.phone || "", preview, params, template, invoices: list });

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
          name: template, lang_code: "en_GB",
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
