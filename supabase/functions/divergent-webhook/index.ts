// Divergent Connect webhook: SMS delivery statuses and inbound replies.
// Verified with RFC 9421 HMAC-SHA256 signatures using DIVERGENT_WEBHOOK_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveOrderLink } from "../_shared/cs-order-linker.ts";

const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

function timingSafeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function verify(req: Request, raw: string, secret: string): Promise<boolean> {
  const sigInput = req.headers.get("signature-input");
  const sigHeader = req.headers.get("signature");
  if (!sigInput || !sigHeader) return false;
  // Content-Digest must match the body
  const digestHeader = req.headers.get("content-digest") || "";
  const actual = b64(await crypto.subtle.digest("SHA-256", enc.encode(raw)));
  const dm = digestHeader.match(/sha-256=:([^:]+):/);
  if (dm && dm[1] !== actual) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const url = new URL(req.url);
  // Each signature: label=("@method" ...);created=..;expires=..;keyid=..;alg=..
  for (const part of sigInput.split(/,(?=\s*[\w-]+=\()/)) {
    const m = part.trim().match(/^([\w-]+)=(\(.*?\))(.*)$/);
    if (!m) continue;
    const [, label, list, params] = m;
    const exp = params.match(/expires=(\d+)/);
    if (exp && Number(exp[1]) * 1000 < Date.now()) continue;
    const comps = [...list.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    const lines = comps.map((c) => {
      let v = "";
      if (c === "@method") v = req.method.toUpperCase();
      else if (c === "@authority") v = req.headers.get("host") || url.host;
      else if (c === "@path") v = url.pathname;
      else if (c === "@query") v = url.search || "?";
      else if (c === "@target-uri") v = req.url;
      else v = (req.headers.get(c) || "").trim();
      return `"${c}": ${v}`;
    });
    lines.push(`"@signature-params": ${list}${params}`);
    const expected = b64(await crypto.subtle.sign("HMAC", key, enc.encode(lines.join("\n"))));
    const sm = sigHeader.match(new RegExp(`${label}=:([^:]+):`));
    if (sm && timingSafeEq(sm[1], expected)) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const secret = Deno.env.get("DIVERGENT_WEBHOOK_SECRET");
    if (!secret) return json({ error: "not configured" }, 503);
    const raw = await req.text();
    if (!(await verify(req, raw, secret))) {
      console.warn("divergent-webhook: signature check failed");
      return json({ error: "invalid signature" }, 401);
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const webhookId = req.headers.get("webhook-id");
    if (webhookId) {
      const { error } = await admin.from("divergent_webhook_events").insert({ webhook_id: webhookId });
      if (error) return json({ ok: true, duplicate: true });
    }
    const evt = JSON.parse(raw);
    const data = evt?.data || {};
    console.log("divergent-webhook event:", evt?.type);

    if (evt.type === "sms.delivered" || evt.type === "sms.failed") {
      await admin.from("sms_messages").update({
        status: evt.type === "sms.delivered" ? "delivered" : "failed",
        error: evt.type === "sms.failed" ? String(data?.failure?.reason || data?.statusReason || "failed").slice(0, 300) : null,
        updated_at: new Date().toISOString(),
      }).eq("provider_id", String(data.id));
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
      await admin.from("cs_messages").insert({ conversation_id: conv!.id, direction: "in", body_text: text, external_id: data.id ? String(data.id) : null, status: "received" });
      if (!conv!.auto_link_locked) {
        const link = await resolveOrderLink(admin, { channel: "whatsapp", handle, body: text });
        await admin.from("cs_conversations").update({
          linked_order_id: link.linked_order_id ?? conv!.linked_order_id, suggested_order_ids: link.suggested_order_ids,
        }).eq("id", conv!.id);
      }
    }
    return json({ ok: true });
  } catch (e) {
    console.error("divergent-webhook error:", (e as Error).message);
    return json({ error: "Internal server error" }, 500);
  }
});
