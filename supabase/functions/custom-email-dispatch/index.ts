import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAdminOrCronAuth, createAuthErrorResponse } from "../_shared/auth.ts";
import { renderBlocks, varsFromOrder, fillVars, cleanAddresses, hasCustomBody } from "../_shared/emailTemplates.ts";

/**
 * Sends admin-created ("custom") emails queued by the orders status trigger.
 * Each queue row is claimed atomically so a template is sent at most once per order.
 * Delivery goes through send-email (test-account skip, branding, reply-to).
 */
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAdminOrCronAuth(req);
  if (!auth.success) return createAuthErrorResponse(auth.error || "Unauthorized", auth.status || 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, key);

  const { data: due } = await admin
    .from("custom_email_sends")
    .select("id, template_id, order_id")
    .eq("status", "queued")
    .lte("send_after", new Date().toISOString())
    .limit(100);

  let sent = 0, skipped = 0, failed = 0;
  for (const row of due || []) {
    // Claim
    const { data: claimed } = await admin
      .from("custom_email_sends")
      .update({ status: "sending" })
      .eq("id", row.id).eq("status", "queued")
      .select("id");
    if (!claimed?.length) continue;

    const finish = (status: string, error?: string) =>
      admin.from("custom_email_sends").update({ status, error: error ?? null, sent_at: status === "sent" ? new Date().toISOString() : null }).eq("id", row.id);

    try {
      const [{ data: t }, { data: o }] = await Promise.all([
        admin.from("email_templates").select("*").eq("id", row.template_id).maybeSingle(),
        admin.from("orders").select("id, status, tracking_number, sender, receiver, bikes, bike_brand, bike_model, scheduled_pickup_date, scheduled_delivery_date").eq("id", row.order_id).maybeSingle(),
      ]);
      if (!t || !t.enabled || !o || !hasCustomBody(t.blocks)) { skipped++; await finish("skipped", "disabled or missing"); continue; }

      const recips: string[] = Array.isArray(t.recipients) ? t.recipients : [];
      const targets: { email: string; name: string }[] = [];
      if (recips.includes("sender") && o.sender?.email) targets.push({ email: o.sender.email, name: o.sender.name || "" });
      if (recips.includes("receiver") && o.receiver?.email) targets.push({ email: o.receiver.email, name: o.receiver.name || "" });
      for (const e of cleanAddresses([...(t.cc || []), ...(t.bcc || [])])) targets.push({ email: e, name: "" });
      const unique = [...new Map(targets.map((x) => [x.email.toLowerCase(), x])).values()];
      if (!unique.length) { skipped++; await finish("skipped", "no recipients"); continue; }

      let anyOk = false;
      for (const r of unique) {
        const vars = varsFromOrder(o, r.name);
        const subject = fillVars(t.subject || "Update from Cycle Courier Co.", vars, false);
        const { html, text } = renderBlocks(t.blocks, vars, { subject, preheader: t.preheader });
        const res = await fetch(`${url}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ to: r.email, subject, html, text, skipTemplate: true, meta: { orderId: o.id, action: "custom_email" } }),
        });
        if (res.ok) anyOk = true;
      }
      if (anyOk) { sent++; await finish("sent"); } else { failed++; await finish("failed", "send-email error"); }
    } catch (_e) {
      failed++;
      await finish("failed", "exception");
    }
  }
  return json({ sent, skipped, failed });
});
