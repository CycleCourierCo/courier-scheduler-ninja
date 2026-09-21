// Closes a customer service ticket and emails the customer to confirm.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { sendTicketClosedEmail } from "../_shared/cs-auto-email.ts";

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
    const notify = body?.notify !== false;
    if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return json({ error: 'conversation_id required' }, 400);

    const { data: conv, error: convErr } = await admin
      .from('cs_conversations')
      .select('id, status')
      .eq('id', conversationId)
      .maybeSingle();
    if (convErr) throw convErr;
    if (!conv) return json({ error: 'conversation not found' }, 404);
    if (conv.status === 'closed') return json({ ok: true, already_closed: true });

    const { error: updErr } = await admin
      .from('cs_conversations')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        first_response_due_at: null,
        next_response_due_at: null,
        snooze_until: null,
      })
      .eq('id', conversationId);
    if (updErr) throw updErr;

    // A closed ticket should never receive the "we've got your message" email afterwards.
    await admin.from('cs_conversations')
      .update({ ack_sent_at: new Date().toISOString() })
      .eq('id', conversationId)
      .is('ack_sent_at', null);

    if (notify) {
      await sendTicketClosedEmail(admin, conversationId);
    }

    return json({ ok: true });
  } catch (e: any) {
    console.error('cs-close-ticket error:', e?.message);
    return json({ error: e?.message || 'failed' }, 500);
  }
});
