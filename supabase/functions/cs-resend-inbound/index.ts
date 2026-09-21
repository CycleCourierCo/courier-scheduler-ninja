// Resend inbound-email webhook -> customer service inbox.
// Verifies the Svix signature, then normalises Resend's `email.received` event
// into the shared CS inbound ingestion.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { Webhook } from "https://esm.sh/svix@1.24.0";
import { ingestInboundEmail, isDuplicateInbound, type InboundEmail } from "../_shared/cs-inbound.ts";
import { logInboundWebhook } from "../_shared/integrationLog.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Headers arrive as [{name,value}] or {name: value}; normalise to lowercase keys. */
function headerMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(raw)) {
    for (const h of raw) {
      if (h?.name) out[String(h.name).toLowerCase()] = String(h.value ?? '');
    }
  } else if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[k.toLowerCase()] = String(v ?? '');
    }
  }
  return out;
}

function firstFrom(data: any): string | null {
  const f = data?.from;
  if (typeof f === 'string') return f;
  if (Array.isArray(f) && f.length) return typeof f[0] === 'string' ? f[0] : (f[0]?.address ?? null);
  if (f && typeof f === 'object') {
    return f.name ? `${f.name} <${f.address}>` : (f.address ?? null);
  }
  return null;
}

function normalise(data: any): InboundEmail | null {
  const from = firstFrom(data);
  if (!from) return null;
  const hdrs = headerMap(data?.headers);

  const attachments = Array.isArray(data?.attachments)
    ? data.attachments.map((a: any) => ({
        url: a?.url ?? a?.download_url ?? undefined,
        filename: a?.filename ?? a?.name ?? undefined,
        content_type: a?.content_type ?? a?.contentType ?? undefined,
        size: typeof a?.size === 'number' ? a.size : undefined,
      }))
    : [];

  return {
    from,
    subject: data?.subject ?? hdrs['subject'] ?? undefined,
    text: data?.text ?? data?.plain ?? undefined,
    html: data?.html ?? undefined,
    message_id: data?.message_id ?? hdrs['message-id'] ?? data?.email_id ?? undefined,
    in_reply_to: data?.in_reply_to ?? hdrs['in-reply-to'] ?? hdrs['references']?.split(/\s+/).pop() ?? undefined,
    attachments,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const secret = Deno.env.get('RESEND_INBOUND_WEBHOOK_SECRET')
      ?? Deno.env.get('RESEND_WEBHOOK_SECRET');
    if (!secret) {
      console.error('No Resend inbound webhook secret configured');
      return json({ error: 'missing secret' }, 500);
    }

    const payload = await req.text();
    let evt: any;
    try {
      evt = new Webhook(secret).verify(payload, {
        'svix-id': req.headers.get('svix-id') ?? '',
        'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
        'svix-signature': req.headers.get('svix-signature') ?? '',
      });
      logInboundWebhook('resend', 'inbound email');
    } catch (err) {
      console.error('Inbound signature verification failed:', (err as Error).message);
      logInboundWebhook('resend', 'inbound email', {
        success: false, statusCode: 401, errorLabel: 'invalid_signature',
      });
      return json({ error: 'invalid signature' }, 401);
    }

    const type: string = evt?.type ?? 'unknown';
    // Only inbound receive events create conversations; ignore delivery events.
    if (!/received|inbound/i.test(type)) {
      return json({ ok: true, ignored: type });
    }

    const email = normalise(evt?.data ?? {});
    if (!email) {
      console.error('Inbound event missing sender address');
      return json({ error: 'sender address missing' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    if (await isDuplicateInbound(supabase, email.message_id)) {
      return json({ ok: true, duplicate: true });
    }

    const conversationId = await ingestInboundEmail(supabase, email);
    return json({ ok: true, conversation_id: conversationId });
  } catch (e: any) {
    console.error('cs-resend-inbound error:', e?.message);
    return json({ error: 'failed' }, 500);
  }
});
