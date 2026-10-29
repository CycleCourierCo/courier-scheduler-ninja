// Staff retry for a customer WhatsApp file that couldn't be downloaded when it arrived.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { downloadWhatsAppMedia } from "../_shared/whatsappMediaStore.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
    const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: 'unauthorized' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: roleRows } = await admin.from('user_roles').select('role').eq('user_id', u.user.id);
    const roles = (roleRows || []).map((r: any) => r.role);
    if (!roles.includes('admin') && !roles.includes('cs_agent')) return json({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const messageId = String(body?.message_id || '');
    const index = Number(body?.index ?? 0);
    if (!/^[0-9a-f-]{36}$/i.test(messageId) || !Number.isInteger(index) || index < 0 || index > 20) {
      return json({ error: 'message_id and index required' }, 400);
    }
    const { data: msg } = await admin.from('cs_messages').select('id, conversation_id, attachments, direction')
      .eq('id', messageId).maybeSingle();
    if (!msg || msg.direction !== 'in') return json({ error: 'not found' }, 404);
    const atts = Array.isArray(msg.attachments) ? [...msg.attachments] : [];
    const att = atts[index];
    if (!att?.download_failed) return json({ ok: true, already: true });
    const stored = await downloadWhatsAppMedia(admin, msg.conversation_id, att);
    if (!stored) return json({ error: 'still unavailable' }, 502);
    const { download_failed: _d, ...rest } = att;
    atts[index] = { ...rest, url: stored.url, path: stored.path, size: stored.size };
    await admin.from('cs_messages').update({ attachments: atts }).eq('id', msg.id);
    return json({ ok: true });
  } catch (e: any) {
    console.error('cs-whatsapp-media-retry error:', e?.message);
    return json({ error: 'failed' }, 500);
  }
});
