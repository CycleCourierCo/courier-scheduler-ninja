import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAdminAuth, createAuthErrorResponse } from "../_shared/auth.ts";
import { renderBlocks, varsFromOrder, fillVars, hasCustomBody } from "../_shared/emailTemplates.ts";
import { trackResend } from "../_shared/integrationLog.ts";
import { emailShell, emailUI, htmlToPlainText } from "../_shared/emailLayout.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAdminAuth(req);
  if (!auth.success) return createAuthErrorResponse(auth.error || "Unauthorized", auth.status || 401);

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "test" ? "test" : "preview";
    const tpl = body?.template || {};
    const subjectRaw = String(tpl.subject || "").slice(0, 300);
    const blocks = tpl.blocks && typeof tpl.blocks === "object" ? tpl.blocks : {};
    if (!hasCustomBody(blocks)) return json({ error: "Add a headline or some wording first." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const cols = "tracking_number, sender, receiver, bikes, bike_brand, bike_model, scheduled_pickup_date, scheduled_delivery_date";
    let q = admin.from("orders").select(cols).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1);
    if (typeof body?.trackingNumber === "string" && body.trackingNumber.trim()) {
      q = admin.from("orders").select(cols).eq("tracking_number", body.trackingNumber.trim()).limit(1);
    }
    const { data: rows } = await q;
    const order = rows?.[0] || null;
    const vars = varsFromOrder(order, order?.sender?.name || "Alex");
    const subject = fillVars(subjectRaw || "(no subject)", vars, false);
    let html: string, text: string;
    let row: any = null;
    if (typeof tpl.id === "string") {
      const { data } = await admin.from("email_templates").select("wording_mode, sample_html").eq("id", tpl.id).maybeSingle();
      row = data;
    }
    if (row?.wording_mode === "intro") {
      let intro = blocks.headline ? emailUI.heading(fillVars(blocks.headline, vars, true)) : "";
      for (const p of (blocks.paragraphs || []).filter((x: string) => x.trim())) intro += emailUI.paragraph(fillVars(p, vars, true).replace(/\n/g, "<br>"));
      const base = row.sample_html || emailShell("", { subject });
      const m = base.match(/<body[^>]*>/i);
      html = m ? base.replace(m[0], m[0] + intro) : intro + base;
      text = htmlToPlainText(html);
    } else {
      ({ html, text } = renderBlocks(blocks, vars, { subject, preheader: tpl.preheader }));
    }

    if (mode === "preview") return json({ html, subject, trackingNumber: order?.tracking_number || null });

    const { data: u } = await admin.auth.admin.getUserById(auth.userId!);
    const to = u?.user?.email;
    if (!to) return json({ error: "Your account has no email address." }, 400);
    const resend = trackResend(new Resend(Deno.env.get("RESEND_API_KEY")!), "email centre test");
    const { error } = await resend.emails.send({
      from: "CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>",
      to: [to],
      reply_to: "Info@cyclecourierco.com",
      subject: `[TEST] ${subject}`,
      html,
      text,
    } as any);
    if (error) return json({ error: "The test email could not be sent." }, 502);
    if (typeof tpl.id === "string") {
      await admin.from("email_templates").update({ tested_at: new Date().toISOString() }).eq("id", tpl.id);
    }
    return json({ success: true, sentTo: to });
  } catch (_e) {
    console.error("email-template-preview failed");
    return json({ error: "Preview failed" }, 500);
  }
});
