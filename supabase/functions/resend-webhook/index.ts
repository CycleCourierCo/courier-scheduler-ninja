// Resend webhook receiver: verifies Svix signature and logs delivery events.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Webhook } from "https://esm.sh/svix@1.24.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (!secret) {
      console.error("RESEND_WEBHOOK_SECRET is not set");
      return new Response(JSON.stringify({ error: "missing secret" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.text();
    const svixId = req.headers.get("svix-id") ?? "";
    const svixTs = req.headers.get("svix-timestamp") ?? "";
    const svixSig = req.headers.get("svix-signature") ?? "";

    console.log("Incoming Resend webhook:", JSON.stringify({
      svix_id: svixId,
      svix_timestamp: svixTs,
      svix_signature_length: svixSig.length,
      svix_signature_prefix: svixSig.slice(0, 12),
      payload_bytes: payload.length,
      secret_set: true,
      secret_length: secret.length,
      secret_prefix: secret.slice(0, 6),
    }));

    const headers = {
      "svix-id": svixId,
      "svix-timestamp": svixTs,
      "svix-signature": svixSig,
    };

    let evt: any;
    try {
      const wh = new Webhook(secret);
      evt = wh.verify(payload, headers);
      console.log("Signature verification PASSED, event type:", evt?.type ?? "unknown");
    } catch (err) {
      console.error("Signature verification FAILED:", (err as Error).message);
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resend event payload: { type: 'email.delivered', created_at, data: { email_id, to, tags } }
    const type: string = evt?.type ?? "unknown";
    const eventType = type.startsWith("email.") ? type.slice(6) : type;
    const data = evt?.data ?? {};

    // Tags arrive as either object {k:v} (on send) or array [{name,value}] (in events).
    let tagMap: Record<string, string> = {};
    if (Array.isArray(data.tags)) {
      for (const t of data.tags) {
        if (t?.name) tagMap[t.name] = t.value;
      }
    } else if (data.tags && typeof data.tags === "object") {
      tagMap = data.tags;
    }

    const recipient = Array.isArray(data.to) ? data.to[0] : data.to ?? null;
    const orderId = tagMap.order_id ?? null;
    const side = tagMap.side ?? null;
    const emailType = tagMap.email_type ?? null;

    const { error } = await supabase.from("email_delivery_events").insert({
      resend_email_id: data.email_id ?? null,
      recipient,
      event_type: eventType,
      order_id: orderId && /^[0-9a-f-]{36}$/i.test(orderId) ? orderId : null,
      side,
      email_type: emailType,
      payload: evt,
    });

    if (error) {
      console.error("Insert failed:", error.message);
      return new Response(JSON.stringify({ error: "insert failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", (e as Error).message);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
