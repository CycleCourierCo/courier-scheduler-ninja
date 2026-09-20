// Polls Resend's received-email API and ingests anything the inbound webhook
// missed. Safe to re-run: duplicates are filtered on RFC822 Message-ID.
//
// Auth: X-Cron-Secret (scheduled) or an admin JWT (manual "Sync now").
// Body (optional): { "email_id": "<resend received email id>" } to fetch one.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { ingestInboundEmail, isDuplicateInbound, type InboundEmail } from "../_shared/cs-inbound.ts";
import { sendTicketReceivedEmail } from "../_shared/cs-auto-email.ts";
import { requireAdminOrCronAuth, requireOpsAuth, createAuthErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RESEND_BASE = 'https://api.resend.com';
const MAX_EMAILS = 50;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function resendGet(path: string, apiKey: string): Promise<any> {
  const res = await fetch(`${RESEND_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Resend GET ${path} failed [${res.status}]: ${text.slice(0, 400)}`);
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Resend GET ${path} returned non-JSON body`);
  }
}

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
  if (f && typeof f === 'object') return f.name ? `${f.name} <${f.address}>` : (f.address ?? null);
  return null;
}

function normalise(data: any, attachments: any[]): InboundEmail | null {
  const from = firstFrom(data);
  if (!from) return null;
  const hdrs = headerMap(data?.headers);

  return {
    from,
    subject: data?.subject ?? hdrs['subject'] ?? undefined,
    text: data?.text ?? data?.plain ?? undefined,
    html: data?.html ?? undefined,
    // Prefer the RFC822 Message-ID so webhook and poller dedupe against each other.
    message_id: data?.message_id ?? hdrs['message-id'] ?? (data?.id ? `resend:${data.id}` : undefined),
    in_reply_to: data?.in_reply_to ?? hdrs['in-reply-to']
      ?? hdrs['references']?.split(/\s+/).pop() ?? undefined,
    attachments: attachments.map((a: any) => ({
      url: a?.url ?? a?.download_url ?? undefined,
      filename: a?.filename ?? a?.name ?? undefined,
      content_type: a?.content_type ?? a?.contentType ?? undefined,
      size: typeof a?.size === 'number' ? a.size : undefined,
    })),
  };
}

function listIds(payload: any): string[] {
  const rows = Array.isArray(payload) ? payload : (payload?.data ?? payload?.emails ?? []);
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r: any) => (typeof r === 'string' ? r : r?.id))
    .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    .slice(0, MAX_EMAILS);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let auth = await requireAdminOrCronAuth(req);
  if (!auth.success) {
    // Also allow internal service-role invocation and route planners.
    auth = await requireOpsAuth(req, ['admin', 'route_planner']);
  }
  if (!auth.success) {
    return createAuthErrorResponse(auth.error ?? 'Unauthorized', auth.status ?? 401);
  }

  // The main sending key is usually restricted to sending; reading received
  // emails needs a key with full access.
  const apiKey = Deno.env.get('RESEND_RECEIVING_API_KEY') ?? Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('cs-resend-fetch: no Resend API key configured');
    return json({ error: 'email service not configured' }, 500);
  }

  let requestedId: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.email_id === 'string' && /^[0-9a-zA-Z-]{6,64}$/.test(body.email_id)) {
      requestedId = body.email_id;
    }
  } catch {
    // no body — full sync
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    let ids: string[];
    if (requestedId) {
      ids = [requestedId];
    } else {
      const list = await resendGet(`/emails/receiving?limit=${MAX_EMAILS}`, apiKey);
      ids = listIds(list);
    }

    let imported = 0;
    let duplicates = 0;
    const failures: Array<{ id: string; reason: string }> = [];

    for (const id of ids) {
      try {
        const detail = await resendGet(`/emails/receiving/${id}`, apiKey);
        const data = detail?.data ?? detail;

        let attachments: any[] = [];
        try {
          const attachmentPayload = await resendGet(`/emails/receiving/${id}/attachments`, apiKey);
          const rows = Array.isArray(attachmentPayload)
            ? attachmentPayload
            : (attachmentPayload?.data ?? []);
          if (Array.isArray(rows)) attachments = rows;
        } catch (attachErr) {
          console.error('cs-resend-fetch attachment listing failed', (attachErr as Error).message);
        }

        const email = normalise({ ...data, id }, attachments);
        if (!email) {
          failures.push({ id, reason: 'sender address missing' });
          continue;
        }

        if (await isDuplicateInbound(supabase, email.message_id)) {
          duplicates++;
          continue;
        }

        await ingestInboundEmail(supabase, email);
        imported++;
      } catch (err) {
        console.error('cs-resend-fetch failed for received email', { id, message: (err as Error).message });
        failures.push({ id, reason: (err as Error).message.slice(0, 200) });
      }
    }

    // Retry confirmations for recent email tickets that never got one.
    let acksRetried = 0;
    try {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: pending } = await supabase
        .from('cs_conversations')
        .select('id')
        .eq('channel', 'email')
        .is('ack_sent_at', null)
        .neq('status', 'closed')
        .gte('created_at', since)
        .limit(25);
      for (const row of pending || []) {
        try {
          await sendTicketReceivedEmail(supabase, row.id);
          acksRetried++;
        } catch (ackErr) {
          console.error('cs-resend-fetch ack retry failed', (ackErr as Error).message);
        }
      }
    } catch (sweepErr) {
      console.error('cs-resend-fetch ack sweep failed', (sweepErr as Error).message);
    }

    console.log('cs-resend-fetch complete', { checked: ids.length, imported, duplicates, failed: failures.length, acksRetried });
    return json({ ok: true, checked: ids.length, imported, duplicates, acks_retried: acksRetried, failures });
  } catch (e: any) {
    console.error('cs-resend-fetch error:', e?.message);
    return json({ error: 'sync failed', details: String(e?.message ?? '').slice(0, 300) }, 502);
  }
});
