import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeQuickBooksString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function splitName(fullName: string | null): { given: string; family: string } {
  if (!fullName) return { given: '', family: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { given: parts[0], family: '' };
  return { given: parts[0], family: parts.slice(1).join(' ') };
}

async function refreshQuickBooksToken(supabase: any, userId: string, refreshToken: string) {
  const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
  const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
      'Accept': 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await supabase.from('quickbooks_tokens').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);
  return { access_token: data.access_token };
}

async function getValidQuickBooksToken(supabase: any, userId: string) {
  const { data: tokenData } = await supabase
    .from('quickbooks_tokens')
    .select('access_token, refresh_token, expires_at, company_id')
    .eq('user_id', userId)
    .single();
  if (!tokenData) return null;
  const expiresAt = new Date(tokenData.expires_at);
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshQuickBooksToken(supabase, userId, tokenData.refresh_token);
    if (!refreshed) return null;
    return { access_token: refreshed.access_token, company_id: tokenData.company_id };
  }
  return { access_token: tokenData.access_token, company_id: tokenData.company_id };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) throw new Error('Admin access required');

    const tokenInfo = await getValidQuickBooksToken(supabase, user.id);
    if (!tokenInfo) throw new Error('QuickBooks not connected for this admin');

    const baseUrl = `https://quickbooks.api.intuit.com/v3/company/${tokenInfo.company_id}`;
    const authHeaders = {
      'Authorization': `Bearer ${tokenInfo.access_token}`,
      'Accept': 'application/json',
    };

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, email, accounts_email, phone, company_name, website, address_line_1, address_line_2, city, postal_code')
      .eq('is_business', true)
      .eq('account_status', 'approved')
      .is('quickbooks_customer_id', null);
    if (profilesError) throw profilesError;

    const details: any[] = [];
    let linked = 0, created = 0, skipped = 0, errors = 0;

    for (const profile of profiles || []) {
      const qbEmail = (profile.accounts_email?.trim() || profile.email?.trim()) || '';
      if (!qbEmail) {
        skipped++;
        details.push({ userId: profile.id, status: 'skipped', reason: 'no email or accounts email' });
        continue;
      }

      try {
        const escapedEmail = escapeQuickBooksString(qbEmail);
        const queryUrl = `${baseUrl}/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE PrimaryEmailAddr = '${escapedEmail}'`)}`;
        const searchResp = await fetch(queryUrl, { headers: authHeaders });
        if (searchResp.ok) {
          const searchData = await searchResp.json();
          const existing = searchData.QueryResponse?.Customer?.[0];
          if (existing) {
            await supabase.from('profiles').update({ quickbooks_customer_id: existing.Id }).eq('id', profile.id);
            linked++;
            details.push({ userId: profile.id, email: qbEmail, status: 'linked', customerId: existing.Id });
            await new Promise(r => setTimeout(r, 150));
            continue;
          }
        }

        const { given, family } = splitName(profile.name);
        const displayName = profile.company_name || profile.name || qbEmail;
        const customerPayload: any = {
          DisplayName: displayName,
          CompanyName: profile.company_name || undefined,
          GivenName: given || undefined,
          FamilyName: family || undefined,
          PrimaryEmailAddr: { Address: qbEmail },
        };
        if (profile.phone) customerPayload.PrimaryPhone = { FreeFormNumber: profile.phone };
        if (profile.website) customerPayload.WebAddr = { URI: profile.website };
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
          const errBody = await createResp.text();
          errors++;
          details.push({ userId: profile.id, email: qbEmail, status: 'error', error: `${createResp.status}: ${errBody.slice(0, 200)}` });
        } else {
          const createdData = await createResp.json();
          const customerId = createdData.Customer?.Id;
          if (customerId) {
            await supabase.from('profiles').update({ quickbooks_customer_id: customerId }).eq('id', profile.id);
            created++;
            details.push({ userId: profile.id, email: qbEmail, status: 'created', customerId });
          } else {
            errors++;
            details.push({ userId: profile.id, email: qbEmail, status: 'error', error: 'no customer id returned' });
          }
        }
      } catch (err: any) {
        errors++;
        details.push({ userId: profile.id, email: qbEmail, status: 'error', error: err?.message || String(err) });
      }

      await new Promise(r => setTimeout(r, 150));
    }

    return new Response(
      JSON.stringify({ total: profiles?.length || 0, linked, created, skipped, errors, details }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('backfill-quickbooks-customers error:', error?.message || error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
