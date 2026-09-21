// Generic inbound email webhook (simple JSON payload). Creates CS contact/conversation/message.
// Resend's signed inbound webhook is handled by cs-resend-inbound instead.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { ingestInboundEmail, isDuplicateInbound, type InboundEmail } from "../_shared/cs-inbound.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as InboundEmail;
    if (!body?.from) {
      return new Response(JSON.stringify({ error: 'from required' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    if (await isDuplicateInbound(supabase, body.message_id)) {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const conversationId = await ingestInboundEmail(supabase, body);

    return new Response(JSON.stringify({ ok: true, conversation_id: conversationId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('cs-inbound-email error:', e?.message);
    return new Response(JSON.stringify({ error: e?.message || 'failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
