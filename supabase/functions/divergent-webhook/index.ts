// Divergent Connect webhook: SMS delivery statuses and inbound replies.
// Verified with RFC 9421 HMAC-SHA256 signatures using DIVERGENT_WEBHOOK_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveOrderLink } from "../_shared/cs-order-linker.ts";
import { verify } from "./verify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  let claimed: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;
  try {
    const secret = Deno.env.get("DIVERGENT_WEBHOOK_SECRET");
    if (!secret) return json({ error: "not configured" }, 503);
    const raw = await req.text();
    if (!(await verify(req, raw, secret))) {
      console.warn("divergent-webhook: signature check failed");
      return json({ error: "invalid signature" }, 401);
    }
    admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const webhookId = req.headers.get("webhook-id")!;
    const { error: claimError } = await admin.from("divergent_webhook_events").insert({ webhook_id: webhookId });
    if (claimError?.code === "23505") return json({ ok: true, duplicate: true });
    if (claimError) throw claimError;
    claimed = webhookId;
    const evt = JSON.parse(raw);
    const data = evt?.data || {};
    console.log("divergent-webhook event:", evt?.type);

    if (evt.type === "sms.delivered" || evt.type === "sms.failed") {
      const { error: smsError } = await admin.from("sms_messages").update({
        status: evt.type === "sms.delivered" ? "delivered" : "failed",
        error: evt.type === "sms.failed" ? String(data?.failure?.reason || data?.statusReason || "failed").slice(0, 300) : null,
        updated_at: new Date().toISOString(),
      }).eq("provider_id", String(data.id));
      if (smsError) throw smsError;
    } else if (evt.type === "sms.received") {
      const from = String(data.sender || data.from || data.originator || "").replace(/[^\d+]/g, "");
      const text = String(data.content || data.text || "");
      if (!from || !text) return json({ ok: true });
      const handle = from.startsWith("+") ? from : `+${from}`;
      const { data: contact, error: cErr } = await admin.from("cs_contacts")
        .upsert({ channel: "sms", handle }, { onConflict: "channel,handle" }).select().single();
      if (cErr) throw cErr;
      const now = new Date().toISOString();
      let { data: conv } = await admin.from("cs_conversations").select("id, linked_order_id, auto_link_locked")
        .eq("contact_id", contact.id).eq("channel", "sms").neq("status", "closed")
        .order("last_message_at", { ascending: false }).limit(1).maybeSingle();
      if (conv?.id) {
        await admin.from("cs_conversations").update({ status: "open", last_message_at: now, last_message_preview: text.slice(0, 140), unread_count: 1 }).eq("id", conv.id);
      } else {
        const { data: created, error } = await admin.from("cs_conversations").insert({
          channel: "sms", contact_id: contact.id, status: "open", last_message_at: now, last_message_preview: text.slice(0, 140), unread_count: 1,
        }).select().single();
        if (error) throw error;
        conv = { id: created.id, linked_order_id: null, auto_link_locked: false } as any;
      }
      const { error: messageError } = await admin.from("cs_messages").insert({ conversation_id: conv!.id, direction: "in", body_text: text, external_id: data.id ? String(data.id) : null, status: "received" });
      if (messageError) throw messageError;
      if (!conv!.auto_link_locked) {
        const link = await resolveOrderLink(admin, { channel: "whatsapp", handle, body: text });
        await admin.from("cs_conversations").update({
          linked_order_id: link.linked_order_id ?? conv!.linked_order_id, suggested_order_ids: link.suggested_order_ids,
        }).eq("id", conv!.id);
      }
    }
    return json({ ok: true });
  } catch (e) {
    // Release the claim so Divergent's retry can process the event.
    if (claimed && admin) await admin.from("divergent_webhook_events").delete().eq("webhook_id", claimed);
    console.error("divergent-webhook error");
    return json({ error: "Internal server error" }, 500);
  }
});
