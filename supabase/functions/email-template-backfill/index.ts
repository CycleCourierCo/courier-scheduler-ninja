// Admin-only: fills Email Centre previews from emails already sent through Resend.
// mode "subjects": returns distinct recent subjects (no bodies) so rules can be built.
// mode "apply": { rules: { [templateKey]: regexSource } } saves the newest matching email
// per template as its sample. Templates that already have a sample are left alone.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAdminOrCronAuth, createAuthErrorResponse } from "../_shared/auth.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Subject patterns taken from each sender's current subject line. Emails whose
// subject is shared by several templates are left out; they fill on their next send.
const DEFAULT_RULES: Record<string, string> = {
  "account.application_received": "^Your Business Account Application",
  "internal.registration_needs_approval": "^New Business Registration Requires",
  "op.receiver_inspection_invoice": "^Invoice for your bike repair",
  "internal.report_customer_updates": "^Customer updates —",
  "internal.report_daily_ops": "^Daily ops —",
  "internal.report_weekly_driver": "^Weekly driver report",
  "internal.report_weekly_van": "^Weekly van report",
  "internal.report_weekly_workshop": "^Weekly workshop report",
  "internal.report_parts_to_order": "^Parts to order",
  "op.task_assignment": "^New task assigned",
  "op.timeslip_email": "Timeslip",
  "op.return_to_seller_notification": "^Returning to seller",
  "internal.invoice_created": "^Invoice Created:",
  "op.route_report": "Route Report",
  "op.driver_absence": "has been (approved|declined|rejected)$",
  "order.created": "^Your Order Has Been Created",
  "order.unboxed_preparation": "^How to prepare your bike",
  "order.delivery_notification": "^Your Bicycle Delivery -",
  "op.repair_offer": "^Optional repairs",
  "op.receiver_repair_confirmation": "^Repairs confirmed",
  "op.repairs_declined_notification": "^Repairs declined",
  "op.loading_list": "Loading List",
  "order.delivered": "Has Been Delivered",
  "type.sender": "^Please confirm your (sender|collection) availability$",
  "type.receiver": "^Please confirm your (receiver|delivery) availability",
  "update.collection_delayed": "^Sorry - we missed your collection",
  "update.delivery_delayed": "^Sorry - we missed your delivery",
  "update.awaiting_sender_dates": "^We need your collection dates",
  "update.awaiting_receiver_dates": "^We need your delivery dates",
  "update.sender_dates_received": "^We're planning your collection",
  "update.collection_scheduled": "^Your collection is booked",
  "update.collection_scheduled_receiver": "^Collection booked for",
  "update.sender_bike_on_way": " is on its way to ",
  "update.delivery_scheduled": "^Your delivery is booked",
  "update.delivery_scheduled_sender": "^Delivery booked for",
};

async function resend(path: string) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`https://api.resend.com${path}`, { headers: { Authorization: `Bearer ${Deno.env.get("RESEND_RECEIVING_API_KEY") ?? Deno.env.get("RESEND_API_KEY")}` } });
    if (r.status === 429) { await sleep(1200 * (i + 1)); continue; }
    if (!r.ok) { const t = (await r.text()).slice(0, 200); throw new Error(`Resend ${r.status}: ${t}`); }
    return await r.json();
  }
  throw new Error("resend rate limited");
}

async function listEmails(pages: number) {
  const out: any[] = [];
  let after: string | null = null;
  for (let p = 0; p < pages; p++) {
    const res: any = await resend(`/emails?limit=100${after ? `&after=${after}` : ""}`);
    const rows = res?.data || [];
    out.push(...rows);
    if (!res?.has_more || !rows.length) break;
    after = rows[rows.length - 1].id;
    await sleep(600);
  }
  return out; // newest first
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAdminOrCronAuth(req);
  if (!auth.success) return createAuthErrorResponse(auth.error || "Unauthorized", auth.status || 401);
  try {
    const body = await req.json().catch(() => ({}));
    const pages = Math.min(Math.max(Number(body?.pages) || 10, 1), 50);
    const emails = await listEmails(pages);
    const shape = (s: string) => String(s || "").replace(/CCC\w+/g, "#").replace(/\d+/g, "0").slice(0, 120);

    if (body?.mode === "subjects") {
      const counts: Record<string, number> = {};
      for (const e of emails) counts[shape(e.subject)] = (counts[shape(e.subject)] || 0) + 1;
      return json({ scanned: emails.length, subjects: counts });
    }

    const rules: Record<string, string> = { ...DEFAULT_RULES, ...(body?.rules && typeof body.rules === "object" ? body.rules : {}) };
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tpls } = await admin.from("email_templates").select("key, sample_html");
    const result: Record<string, string> = {};
    for (const t of tpls || []) {
      if (t.sample_html && !body?.overwrite) { result[t.key] = "already had preview"; continue; }
      const src = rules[t.key];
      if (!src) { result[t.key] = "no rule"; continue; }
      const re = new RegExp(src, "i");
      const hit = emails.find((e) => re.test(e.subject || "") && !/^\[TEST\]/.test(e.subject || ""));
      if (!hit) { result[t.key] = "not found in recent emails"; continue; }
      const full: any = await resend(`/emails/${hit.id}`);
      await sleep(600);
      if (!full?.html) { result[t.key] = "no body stored"; continue; }
      await admin.from("email_templates").update({
        sample_subject: String(full.subject || "").slice(0, 300),
        sample_html: String(full.html).slice(0, 400_000),
        sample_at: full.created_at || new Date().toISOString(),
      }).eq("key", t.key);
      result[t.key] = "filled";
    }
    return json({ scanned: emails.length, result });
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 300);
    console.error("email-template-backfill failed", msg);
    return json({ error: msg }, 500);
  }
});
