// Sends (or re-sends) the "we've received your message" confirmation for a ticket.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { sendTicketReceivedEmail } from "../_shared/cs-auto-email.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: roleRows } = await admin
      .from('user_roles').select('role').eq('user_id', userData.user.id);
    const roles = (roleRows || []).map((r: any) => r.role);
    if (!roles.includes('admin') && !roles.includes('cs_agent')) return json({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const conversationId = typeof body?.conversation_id === 'string' ? body.conversation_id : '';
    const force = body?.force === true;
    if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return json({ error: 'conversation_id required' }, 400);

    const { data: conv } = await admin
      .from('cs_conversations')
      .select('id, ack_sent_at')
      .eq('id', conversationId)
      .maybeSingle();
    if (!conv) return json({ error: 'conversation not found' }, 404);

    if (conv.ack_sent_at && !force) return json({ ok: true, already_sent: true });
    if (force) {
      await admin.from('cs_conversations').update({ ack_sent_at: null }).eq('id', conversationId);
    }

    await sendTicketReceivedEmail(admin, conversationId);

    const { data: after } = await admin
      .from('cs_conversations')
      .select('ack_sent_at')
      .eq('id', conversationId)
      .maybeSingle();

    if (!after?.ack_sent_at) return json({ error: 'send failed' }, 502);
    return json({ ok: true });
  } catch (e: any) {
    console.error('cs-send-ack error:', e?.message);
    return json({ error: e?.message || 'failed' }, 500);
  }
});
