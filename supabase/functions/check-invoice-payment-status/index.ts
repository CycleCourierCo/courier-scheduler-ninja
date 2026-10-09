import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const QB = 'https://quickbooks.api.intuit.com/v3/company';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

async function getToken(supabase: any) {
  const { data } = await supabase.from('quickbooks_tokens')
    .select('user_id, access_token, refresh_token, expires_at, company_id')
    .order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() - Date.now() > 5 * 60 * 1000) return data;
  const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
  const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      Accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refresh_token }).toString(),
  });
  if (!res.ok) return null;
  const r = await res.json();
  const expiresAt = new Date(Date.now() + r.expires_in * 1000).toISOString();
  await supabase.from('quickbooks_tokens').update({
    access_token: r.access_token, refresh_token: r.refresh_token || data.refresh_token,
    expires_at: expiresAt, updated_at: new Date().toISOString(),
  }).eq('user_id', data.user_id);
  return { ...data, access_token: r.access_token };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Unauthorized' }, 401);
    const { data: { user } } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', user.id),
    ]);
    const allowed = ['admin', 'cs_agent'];
    if (!allowed.includes(profile?.role) && !(roles || []).some((r: any) => allowed.includes(r.role))) {
      return json({ error: 'Admin or customer service access required' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.invoiceIds) ? body.invoiceIds : [];
    const clean = [...new Set(ids.map(String).filter((v) => /^\d{1,20}$/.test(v)))].slice(0, 500);
    if (clean.length === 0) return json({ statuses: {} });

    const token = await getToken(supabase);
    if (!token) return json({ error: 'QuickBooks is not connected.' }, 400);

    const statuses: Record<string, { balance: number; total: number; status: string }> = {};
    for (let i = 0; i < clean.length; i += 50) {
      const batch = clean.slice(i, i + 50);
      const query = `SELECT Id, Balance, TotalAmt FROM Invoice WHERE Id IN (${batch.map((id) => `'${id}'`).join(',')}) MAXRESULTS 50`;
      const res = await fetch(`${QB}/${token.company_id}/query?query=${encodeURIComponent(query)}&minorversion=65`, {
        headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`QuickBooks query failed (${res.status})`);
      const found = new Set<string>();
      for (const inv of data.QueryResponse?.Invoice || []) {
        const total = Number(inv.TotalAmt || 0);
        const balance = Number(inv.Balance || 0);
        found.add(String(inv.Id));
        statuses[String(inv.Id)] = {
          total, balance,
          status: total === 0 ? 'voided' : balance <= 0 ? 'paid' : balance < total ? 'part_paid' : 'unpaid',
        };
      }
      for (const id of batch) if (!found.has(id)) statuses[id] = { total: 0, balance: 0, status: 'deleted' };
    }
    return json({ statuses });
  } catch (e) {
    console.error('check-invoice-payment-status error:', e instanceof Error ? e.message : 'unknown');
    return json({ error: 'Could not check QuickBooks' }, 500);
  }
});
