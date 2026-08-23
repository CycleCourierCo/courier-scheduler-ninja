import { requireOpsAuth, createAuthErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Staff only — the carrier list contains driver contact details
  const auth = await requireOpsAuth(req, ['admin', 'route_planner', 'loader']);
  if (!auth.success) {
    return createAuthErrorResponse(auth.error!, auth.status!);
  }

  try {


    const shipdayApiKey = Deno.env.get('SHIPDAY_API_KEY');
    if (!shipdayApiKey) {
      return new Response(JSON.stringify({ error: 'Shipday API key not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const response = await fetch('https://api.shipday.com/carriers', {
      headers: {
        'Authorization': `Basic ${shipdayApiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shipday API error:', response.status);
      return new Response(JSON.stringify({ error: 'Failed to fetch carriers from Shipday' }), { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const carriers = await response.json();

    return new Response(JSON.stringify(carriers), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching carriers:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
