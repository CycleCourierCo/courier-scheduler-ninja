import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QB = 'https://quickbooks.api.intuit.com/v3/company';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function getToken(supabase: any, userId: string) {
  let { data } = await supabase.from('quickbooks_tokens')
    .select('user_id, access_token, refresh_token, expires_at, company_id').eq('user_id', userId).maybeSingle();
  if (!data) {
    const r = await supabase.from('quickbooks_tokens')
      .select('user_id, access_token, refresh_token, expires_at, company_id')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    data = r.data;
  }
  if (!data) return null;
  if (new Date(data.expires_at).getTime() - Date.now() > 5 * 60 * 1000) return data;
  const id = Deno.env.get('QUICKBOOKS_CLIENT_ID'), secret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
  if (!id || !secret) return null;
  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`${id}:${secret}`)}`, Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refresh_token }).toString(),
  });
  if (!res.ok) return null;
  const t = await res.json();
  const expires_at = new Date(Date.now() + t.expires_in * 1000).toISOString();
  await supabase.from('quickbooks_tokens').update({
    access_token: t.access_token, refresh_token: t.refresh_token || data.refresh_token, expires_at, updated_at: new Date().toISOString(),
  }).eq('user_id', data.user_id);
  return { ...data, access_token: t.access_token };
}

async function qbQuery(tok: any, q: string) {
  const res = await fetch(`${QB}/${tok.company_id}/query?query=${encodeURIComponent(q)}&minorversion=65`, {
    headers: { Authorization: `Bearer ${tok.access_token}`, Accept: 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.Fault?.Error?.[0]?.Detail || `QuickBooks query failed (${res.status})`);
  return body.QueryResponse || {};
}

async function qbPost(tok: any, body: unknown) {
  const res = await fetch(`${QB}/${tok.company_id}/item?minorversion=65`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok.access_token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.Fault?.Error?.[0]?.Detail || data?.Fault?.Error?.[0]?.Message || `QuickBooks save failed (${res.status})`);
  return data.Item;
}

const shape = (i: any) => ({
  id: i.Id, syncToken: i.SyncToken, name: i.Name, type: i.Type, description: i.Description ?? '',
  price: i.UnitPrice ?? 0, active: i.Active !== false,
  taxCodeId: i.SalesTaxCodeRef?.value ?? null, taxCodeName: i.SalesTaxCodeRef?.name ?? null,
  incomeAccountId: i.IncomeAccountRef?.value ?? null, incomeAccountName: i.IncomeAccountRef?.name ?? null,
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Unauthorized' }, 401);
    const { data: { user } } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = profile?.role === 'admin' || (roles || []).some((r: any) => r.role === 'admin');
    if (!isAdmin) return json({ error: 'Admin access required' }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    // Public retail catalogue (read-only) for the product consistency report.
    if (action === 'shopify_list') {
      const res = await fetch('https://cyclecourierco.com/products.json?limit=250');
      if (!res.ok) return json({ error: `Could not read the Shopify shop (${res.status})` }, 502);
      const d = await res.json();
      return json({
        products: (d.products || []).map((p: any) => ({
          id: String(p.id), title: String(p.title || ''),
          variants: (p.variants || []).map((v: any) => ({ id: String(v.id), title: String(v.title || ''), price: Number(v.price) || 0 })),
        })),
      });
    }
    const tok = await getToken(supabase, user.id);
    if (!tok) return json({ error: 'QuickBooks is not connected. Connect it from the Invoices page.' }, 400);

    if (action === 'list') {
      const items: any[] = [];
      for (let start = 1; start < 5000; start += 1000) {
        const r = await qbQuery(tok, `SELECT * FROM Item WHERE Active IN (true, false) STARTPOSITION ${start} MAXRESULTS 1000`);
        const page = r.Item || [];
        items.push(...page);
        if (page.length < 1000) break;
      }
      return json({ items: items.filter((i) => i.Type !== 'Category').map(shape) });
    }

    if (action === 'list_refs') {
      const [tc, acc] = await Promise.all([
        qbQuery(tok, 'SELECT * FROM TaxCode WHERE Active = true MAXRESULTS 1000'),
        qbQuery(tok, "SELECT * FROM Account WHERE AccountType = 'Income' MAXRESULTS 1000"),
      ]);
      return json({
        taxCodes: (tc.TaxCode || []).map((t: any) => ({ id: t.Id, name: t.Name })),
        incomeAccounts: (acc.Account || []).filter((a: any) => a.Active !== false).map((a: any) => ({ id: a.Id, name: a.FullyQualifiedName || a.Name })),
      });
    }

    if (action === 'create' || action === 'update') {
      const p = body.product || {};
      const name = String(p.name || '').trim();
      if (!name || name.length > 100) return json({ error: 'Name is required (max 100 characters)' }, 400);
      if (/[:\t\n]/.test(name)) return json({ error: 'Name cannot contain colons, tabs or line breaks' }, 400);
      const price = Number(p.price);
      if (!Number.isFinite(price) || price < 0) return json({ error: 'Price must be 0 or more' }, 400);
      const type = p.type === 'NonInventory' ? 'NonInventory' : 'Service';
      if (!p.incomeAccountId) return json({ error: 'Income account is required' }, 400);
      const payload: any = {
        Name: name, Type: type, Description: String(p.description || '').slice(0, 4000),
        UnitPrice: Math.round(price * 100) / 100, IncomeAccountRef: { value: String(p.incomeAccountId) },
      };
      if (p.taxCodeId) payload.SalesTaxCodeRef = { value: String(p.taxCodeId) };
      if (action === 'update') {
        if (!p.id || p.syncToken == null) return json({ error: 'Missing product id' }, 400);
        Object.assign(payload, { Id: String(p.id), SyncToken: String(p.syncToken), sparse: true });
      }
      return json({ item: shape(await qbPost(tok, payload)) });
    }

    if (action === 'deactivate' || action === 'reactivate') {
      if (!body.id || body.syncToken == null) return json({ error: 'Missing product id' }, 400);
      const item = await qbPost(tok, { Id: String(body.id), SyncToken: String(body.syncToken), sparse: true, Active: action === 'reactivate' });
      return json({ item: shape(item) });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    console.error('quickbooks-products error:', e?.message);
    return json({ error: e?.message || 'Something went wrong' }, 500);
  }
});
