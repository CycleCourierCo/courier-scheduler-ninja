import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const QB = 'https://quickbooks.api.intuit.com/v3/company';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escapeQb = (v: string) => v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function getToken(supabase: any, userId: string) {
  let { data } = await supabase.from('quickbooks_tokens')
    .select('user_id, access_token, refresh_token, expires_at, company_id').eq('user_id', userId).maybeSingle();
  if (!data) {
    const result = await supabase.from('quickbooks_tokens')
      .select('user_id, access_token, refresh_token, expires_at, company_id')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    data = result.data;
  }
  if (!data) return null;
  if (new Date(data.expires_at).getTime() - Date.now() > 5 * 60 * 1000) return data;
  const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
  const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      Accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refresh_token }).toString(),
  });
  if (!response.ok) return null;
  const refreshed = await response.json();
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase.from('quickbooks_tokens').update({
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || data.refresh_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq('user_id', data.user_id);
  return { ...data, access_token: refreshed.access_token };
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
    const isAdmin = profile?.role === 'admin' || (roles || []).some((r: any) => r.role === 'admin');
    if (!isAdmin) return json({ error: 'Admin access required' }, 403);

    const body = await req.json().catch(() => ({}));
    const invoiceNumber = typeof body.invoiceNumber === 'string' ? body.invoiceNumber.trim() : '';
    const orderIds: string[] = Array.isArray(body.orderIds) ? body.orderIds.filter((id: unknown) => typeof id === 'string' && UUID.test(id)) : [];
    if (!invoiceNumber || invoiceNumber.length > 40) return json({ error: 'Enter a QuickBooks invoice number' }, 400);
    if (orderIds.length === 0 || orderIds.length > 200) return json({ error: 'Choose between 1 and 200 jobs' }, 400);

    const token = await getToken(supabase, user.id);
    if (!token) return json({ error: 'QuickBooks is not connected.' }, 400);

    const query = `SELECT * FROM Invoice WHERE DocNumber = '${escapeQb(invoiceNumber)}'`;
    const res = await fetch(`${QB}/${token.company_id}/query?query=${encodeURIComponent(query)}&minorversion=65`, {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' },
    });
    const qb = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: 'QuickBooks lookup failed' }, 502);
    const invoice = qb.QueryResponse?.Invoice?.[0];
    if (!invoice) return json({ error: `No QuickBooks invoice numbered ${invoiceNumber}` }, 404);

    const { data: orders } = await supabase.from('orders').select('id, tracking_number').in('id', orderIds);
    if (!orders || orders.length === 0) return json({ error: 'Jobs not found' }, 404);

    // Transport lines: assign by tracking number when mentioned, otherwise split evenly
    const byRef = new Map<string, number>();
    let unassigned = 0;
    for (const line of invoice.Line || []) {
      const name = String(line.SalesItemLineDetail?.ItemRef?.name || '');
      if (!/collection\s*(and|&)\s*delivery/i.test(name)) continue;
      const refs = [...new Set((String(line.Description || '').match(/CCC[A-Z0-9]+/gi) || []).map((v: string) => v.toUpperCase()))];
      const amt = Number(line.Amount || 0);
      const matched = refs.filter(r => orders.some((o: any) => String(o.tracking_number || '').toUpperCase() === r));
      if (matched.length === 0) { unassigned += amt; continue; }
      for (const r of matched) byRef.set(r, (byRef.get(r) || 0) + amt / matched.length);
    }
    const evenShare = unassigned / orders.length;

    const rows = orders.map((o: any) => ({
      order_id: o.id,
      quickbooks_invoice_id: String(invoice.Id),
      quickbooks_invoice_number: invoice.DocNumber ? String(invoice.DocNumber) : null,
      quickbooks_invoice_url: `https://qbo.intuit.com/app/invoice?txnId=${invoice.Id}`,
      invoice_date: invoice.TxnDate || null,
      link_source: 'manual',
      transport_net_amount: Math.round(((byRef.get(String(o.tracking_number || '').toUpperCase()) || 0) + evenShare) * 100) / 100,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('order_invoice_links').upsert(rows, { onConflict: 'order_id,quickbooks_invoice_id' });
    if (error) throw error;
    await supabase.from('quickbooks_unmatched_invoices').delete().eq('quickbooks_invoice_id', String(invoice.Id));

    return json({ linked: rows.length, invoiceNumber: invoice.DocNumber, customer: invoice.CustomerRef?.name || null });
  } catch (error) {
    console.error('link-order-invoice error:', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'Linking failed' }, 500);
  }
});
