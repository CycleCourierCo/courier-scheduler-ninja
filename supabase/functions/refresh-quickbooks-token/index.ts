import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function refreshQuickBooksToken(
  supabase: any, 
  userId: string, 
  refreshToken: string
): Promise<{ access_token: string; expires_at: string } | null> {
  try {
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      console.error('QuickBooks credentials not configured');
      return null;
    }

    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    
    const tokenParams = new URLSearchParams({
      'grant_type': 'refresh_token',
      'refresh_token': refreshToken
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
      console.error('Token refresh failed:', errorText);
      return null;
    }

    const tokenData = await tokenResponse.json();
    
    // Update tokens in database
    const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();
    
    const { error: updateError } = await supabase
      .from('quickbooks_tokens')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refreshToken, // Use new refresh token if provided
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating tokens:', updateError);
      return null;
    }

    console.log('QuickBooks token refreshed successfully for user:', userId);
    
    return {
      access_token: tokenData.access_token,
      expires_at: newExpiresAt
    };

  } catch (error) {
    console.error('Error refreshing QuickBooks token:', error);
    return null;
  }
}

export async function getValidQuickBooksToken(
  supabase: any, 
  userId: string
): Promise<{ access_token: string; company_id: string; expires_at: string } | null> {
  try {
    // Get current tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('quickbooks_tokens')
      .select('access_token, refresh_token, expires_at, company_id')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      console.error('No QuickBooks tokens found for user:', userId);
      return null;
    }

    // Check if token is expired (with 5 minute buffer)
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    if (expiresAt.getTime() - now.getTime() < bufferTime) {
      console.log('Token expired or expiring soon, attempting refresh...');
      
      // Try to refresh the token
      const refreshResult = await refreshQuickBooksToken(
        supabase, 
        userId, 
        tokenData.refresh_token
      );
      
      if (refreshResult) {
        return {
          access_token: refreshResult.access_token,
          company_id: tokenData.company_id,
          expires_at: refreshResult.expires_at
        };
      } else {
        console.error('Failed to refresh token');
        return null;
      }
    }

    // Token is still valid
    return {
      access_token: tokenData.access_token,
      company_id: tokenData.company_id,
      expires_at: tokenData.expires_at
    };

  } catch (error) {
    console.error('Error getting valid QuickBooks token:', error);
    return null;
  }
}

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

    // Try to get a valid token (will refresh if needed)
    const validToken = await getValidQuickBooksToken(supabase, user.id);
    
    if (!validToken) {
      throw new Error('QuickBooks not connected or refresh failed. Please reconnect to QuickBooks.');
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Token refreshed successfully',
      expires_at: validToken.expires_at
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in refresh-quickbooks-token function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to refresh token',
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