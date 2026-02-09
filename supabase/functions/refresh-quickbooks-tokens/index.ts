import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdminOrCronAuth, createAuthErrorResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

async function refreshQuickBooksToken(
  supabase: any,
  tokenRecord: any
): Promise<boolean> {
  try {
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      console.error('QuickBooks credentials not configured');
      return false;
    }

    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const credentials = btoa(`${clientId}:${clientSecret}`);
    
    const tokenParams = new URLSearchParams({
      'grant_type': 'refresh_token',
      'refresh_token': tokenRecord.refresh_token
    });

    console.log(`Refreshing token for user: ${tokenRecord.user_id}`);
    
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
      console.error(`Token refresh failed for user ${tokenRecord.user_id}:`, errorText);
      return false;
    }

    const tokenData: RefreshTokenResponse = await tokenResponse.json();
    
    // Update the token in database
    const { error: updateError } = await supabase
      .from('quickbooks_tokens')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', tokenRecord.id);

    if (updateError) {
      console.error(`Failed to update token for user ${tokenRecord.user_id}:`, updateError);
      return false;
    }

    console.log(`Successfully refreshed token for user: ${tokenRecord.user_id}`);
    return true;

  } catch (error) {
    console.error(`Error refreshing token for user ${tokenRecord.user_id}:`, error);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Require admin or cron authentication
  const authResult = await requireAdminOrCronAuth(req);
  if (!authResult.success) {
    return createAuthErrorResponse(authResult.error!, authResult.status!);
  }
  console.log(`Authorized via: ${authResult.authType}`, {
    timestamp: new Date().toISOString(),
    userId: authResult.userId || 'cron',
  });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting QuickBooks token refresh job...');

    // Get all active QuickBooks tokens
    const { data: tokens, error: fetchError } = await supabase
      .from('quickbooks_tokens')
      .select('*')
      .order('updated_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching tokens:', fetchError);
      throw fetchError;
    }

    if (!tokens || tokens.length === 0) {
      console.log('No QuickBooks tokens found to refresh');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No tokens to refresh',
          refreshed: 0,
          failed: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Found ${tokens.length} token(s) to refresh`);

    // Refresh each token
    const results = await Promise.allSettled(
      tokens.map(token => refreshQuickBooksToken(supabase, token))
    );

    const refreshed = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    const failed = results.length - refreshed;

    console.log(`Token refresh complete. Refreshed: ${refreshed}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Refreshed ${refreshed} of ${tokens.length} tokens`,
        refreshed,
        failed,
        total: tokens.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in refresh-quickbooks-tokens function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);
