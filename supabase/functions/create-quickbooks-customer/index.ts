import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateCustomerRequest {
  userId: string;
}

function escapeQuickBooksString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function refreshQuickBooksToken(
  supabase: any,
  userId: string,
  refreshToken: string
): Promise<{ access_token: string; expires_at: string } | null> {
  const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
  const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    console.error('QuickBooks credentials not configured');
    return null;
  }
  const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
      'Accept': 'application/json',
    },
    body: params.toString(),
  });
  if (!resp.ok) {
    console.error('Token refresh failed:', await resp.text());
    return null;
  }
  const data = await resp.json();
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  const { error: updateError } = await supabase
    .from('quickbooks_tokens')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (updateError) {
    console.error('Error updating tokens:', updateError);
    return null;
  }
  return { access_token: data.access_token, expires_at: newExpiresAt };
}

async function getValidQuickBooksToken(supabase: any, userId: string) {
  const { data: tokenData, error } = await supabase
    .from('quickbooks_tokens')
    .select('access_token, refresh_token, expires_at, company_id')
    .eq('user_id', userId)
    .single();
  if (error || !tokenData) {
    console.error('No QuickBooks tokens for user:', userId);
    return null;
  }
  const expiresAt = new Date(tokenData.expires_at);
  const buffer = 5 * 60 * 1000;
  if (expiresAt.getTime() - Date.now() < buffer) {
    const refreshed = await refreshQuickBooksToken(supabase, userId, tokenData.refresh_token);
    if (!refreshed) return null;
    return {
      access_token: refreshed.access_token,
      company_id: tokenData.company_id,
    };
  }
  return { access_token: tokenData.access_token, company_id: tokenData.company_id };
}

function normalizeWebsite(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return undefined;
  }
}

function splitName(fullName: string | null): { given: string; family: string } {
  if (!fullName) return { given: '', family: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { given: parts[0], family: '' };
  return { given: parts[0], family: parts.slice(1).join(' ') };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    // Admin check via user_roles
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });
    if (!isAdmin) throw new Error('Admin access required');

    const { userId }: CreateCustomerRequest = await req.json();
    if (!userId) throw new Error('userId is required');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email, accounts_email, phone, company_name, website, address_line_1, address_line_2, city, postal_code, quickbooks_customer_id')
      .eq('id', userId)
      .single();
    if (profileError || !profile) throw new Error('Profile not found');
    const qbEmail = (profile.accounts_email?.trim() || profile.email?.trim()) || '';
    if (!qbEmail) throw new Error('Profile has no email or accounts email');

    const tokenInfo = await getValidQuickBooksToken(supabase, user.id);
    if (!tokenInfo) throw new Error('QuickBooks not connected for this admin');

    const baseUrl = `https://quickbooks.api.intuit.com/v3/company/${tokenInfo.company_id}`;
    const authHeaders = {
      'Authorization': `Bearer ${tokenInfo.access_token}`,
      'Accept': 'application/json',
    };

    // Helper: try to find an existing customer, either by email or DisplayName.
    const findExisting = async (whereClause: string): Promise<string | null> => {
      const url = `${baseUrl}/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE ${whereClause}`)}`;
      const resp = await fetch(url, { headers: authHeaders });
      if (!resp.ok) {
        console.error('Customer query failed:', resp.status, await resp.text());
        return null;
      }
      const data = await resp.json();
      return data.QueryResponse?.Customer?.[0]?.Id ?? null;
    };

    const linkCustomer = async (customerId: string, alreadyExisted: boolean) => {
      await supabase
        .from('profiles')
        .update({ quickbooks_customer_id: customerId })
        .eq('id', userId);
      return new Response(
        JSON.stringify({ customerId, alreadyExisted }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    };

    // 1) Search by email
    const escapedEmail = escapeQuickBooksString(qbEmail);
    const emailMatchId = await findExisting(`PrimaryEmailAddr = '${escapedEmail}'`);
    if (emailMatchId) {
      console.log('Found existing QB customer by email:', emailMatchId);
      return await linkCustomer(emailMatchId, true);
    }

    // 2) Build the payload and derive the DisplayName we would create.
    const { given, family } = splitName(profile.name);
    const displayName = profile.company_name || profile.name || qbEmail;

    // 3) Search by DisplayName to catch existing customers created without an email
    //    (avoids the QuickBooks "6240 Duplicate Name Exists" error on create).
    const escapedDisplayName = escapeQuickBooksString(displayName);
    const nameMatchId = await findExisting(`DisplayName = '${escapedDisplayName}'`);
    if (nameMatchId) {
      console.log('Found existing QB customer by DisplayName:', nameMatchId);
      return await linkCustomer(nameMatchId, true);
    }

    const customerPayload: any = {
      DisplayName: displayName,
      CompanyName: profile.company_name || undefined,
      GivenName: given || undefined,
      FamilyName: family || undefined,
      PrimaryEmailAddr: { Address: qbEmail },
    };
    if (profile.phone) {
      customerPayload.PrimaryPhone = { FreeFormNumber: profile.phone };
    }
    const normalizedWebsite = normalizeWebsite(profile.website);
    if (normalizedWebsite) {
      customerPayload.WebAddr = { URI: normalizedWebsite };
    }
    if (profile.address_line_1 || profile.city || profile.postal_code) {
      customerPayload.BillAddr = {
        Line1: profile.address_line_1 || undefined,
        Line2: profile.address_line_2 || undefined,
        City: profile.city || undefined,
        PostalCode: profile.postal_code || undefined,
        Country: 'United Kingdom',
      };
    }

    const createResp = await fetch(`${baseUrl}/customer`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(customerPayload),
    });

    if (!createResp.ok) {
      const errorBody = await createResp.text();
      console.error('QuickBooks create customer failed:', createResp.status, errorBody);

      // Parse QB fault to detect duplicate-name (6240) and link the existing customer.
      let qbCode: string | undefined;
      let qbMessage: string | undefined;
      try {
        const parsed = JSON.parse(errorBody);
        const fault = parsed?.Fault?.Error?.[0];
        qbCode = fault?.code;
        qbMessage = fault?.Message;
      } catch { /* not JSON */ }

      if (qbCode === '6240') {
        // Retry the DisplayName lookup — QB's search index may have lagged the first check.
        const retryMatch = await findExisting(`DisplayName = '${escapedDisplayName}'`);
        if (retryMatch) {
          console.log('Recovered from 6240 by linking existing DisplayName match:', retryMatch);
          return await linkCustomer(retryMatch, true);
        }
        return new Response(
          JSON.stringify({
            error: `A QuickBooks customer named "${displayName}" already exists but couldn't be located by search. Please rename or link it manually in QuickBooks.`,
            status: 409,
            details: errorBody,
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          error: qbMessage ? `QuickBooks: ${qbMessage}` : 'Failed to create QuickBooks customer',
          status: createResp.status,
          details: errorBody,
        }),
        { status: createResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const createdData = await createResp.json();
    const customerId = createdData.Customer?.Id;
    if (!customerId) {
      throw new Error('QuickBooks response missing customer Id');
    }

    await supabase
      .from('profiles')
      .update({ quickbooks_customer_id: customerId })
      .eq('id', userId);

    return new Response(
      JSON.stringify({ customerId, alreadyExisted: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('create-quickbooks-customer error:', error?.message || error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
