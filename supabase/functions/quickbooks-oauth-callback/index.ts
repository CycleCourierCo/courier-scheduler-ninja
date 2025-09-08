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

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const companyId = url.searchParams.get('realmId');
    const error = url.searchParams.get('error');

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code || !state) {
      throw new Error('Missing authorization code or state');
    }

    // Verify state parameter
    const { data: stateRecord, error: stateError } = await supabase
      .from('oauth_states')
      .select('user_id, expires_at')
      .eq('state', state)
      .eq('provider', 'quickbooks')
      .single();

    if (stateError || !stateRecord) {
      throw new Error('Invalid state parameter');
    }

    if (new Date(stateRecord.expires_at) < new Date()) {
      throw new Error('State parameter expired');
    }

    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      throw new Error('QuickBooks credentials not configured');
    }

    // Exchange authorization code for tokens
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const redirectUri = 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/quickbooks-oauth-callback';
    
    const tokenParams = new URLSearchParams({
      'grant_type': 'authorization_code',
      'code': code,
      'redirect_uri': redirectUri
    });

    const credentials = btoa(`${clientId}:${clientSecret}`);
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json'
      },
      body: tokenParams.toString()
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    
    // Store tokens securely
    await supabase
      .from('quickbooks_tokens')
      .upsert({
        user_id: stateRecord.user_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
        company_id: companyId,
        scope: tokenData.scope,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    // Clean up used state
    await supabase
      .from('oauth_states')
      .delete()
      .eq('state', state);

    // Redirect back to the application with success
    const redirectUrl = 'https://booking.cyclecourierco.com/invoices?oauth=success';

    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl,
        ...corsHeaders
      }
    });

  } catch (error: any) {
    console.error('Error handling QuickBooks OAuth callback:', error);
    
    // Redirect back to frontend with error
    const redirectUrl = `https://booking.cyclecourierco.com/invoices?oauth=error&message=${encodeURIComponent(error.message)}`;

    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl,
        ...corsHeaders
      }
    });
  }
};

serve(handler);