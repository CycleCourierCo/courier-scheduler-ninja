import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      throw new Error('Admin access required');
    }

    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    if (!clientId) {
      throw new Error('QuickBooks Client ID not configured');
    }

    // Generate state parameter for security
    const state = crypto.randomUUID();
    
    // Store state in database for verification
    await supabase
      .from('oauth_states')
      .insert({
        state: state,
        user_id: user.id,
        provider: 'quickbooks',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
      });

    // QuickBooks OAuth 2.0 authorization URL
    const baseUrl = 'https://appcenter.intuit.com/connect/oauth2';
    const redirectUri = 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/quickbooks-oauth-callback';
    
    const params = new URLSearchParams({
      'client_id': clientId,
      'scope': 'com.intuit.quickbooks.accounting',
      'redirect_uri': redirectUri,
      'response_type': 'code',
      'access_type': 'offline',
      'state': state
    });

    const authUrl = `${baseUrl}?${params.toString()}`;

    return new Response(JSON.stringify({
      success: true,
      authUrl: authUrl,
      state: state
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error initializing QuickBooks OAuth:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to initialize OAuth',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);