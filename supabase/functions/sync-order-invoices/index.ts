import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const QB = 'https://quickbooks.api.intuit.com/v3/company';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

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
  return { ...data, access_token: refreshed.access_token, expires_at: expiresAt };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  let runId: string | null = null;

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Unauthorized' }, 401);
    const { data: { user } } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', user.id),
    ]);
    const isAdmin = profile?.role === 'admin' || (roles || []).some((role: any) => role.role === 'admin');
    if (!isAdmin) return json({ error: 'Admin access required' }, 403);

    const token = await getToken(supabase, user.id);
    if (!token) return json({ error: 'QuickBooks is not connected. Connect it from the Invoices page.' }, 400);

    const { data: run, error: runError } = await supabase.from('order_invoice_sync_runs').insert({
      started_by: user.id,
      status: 'running',
    }).select('id').single();
    if (runError) throw runError;
    runId = run.id;

    const orderMap = new Map<string, string[]>();
    for (let from = 0; ; from += 1000) {
      const { data: orders, error } = await supabase.from('orders')
        .select('id, tracking_number').not('tracking_number', 'is', null).range(from, from + 999);
      if (error) throw error;
      for (const order of orders || []) {
        const tracking = String(order.tracking_number).toUpperCase();
        orderMap.set(tracking, [...(orderMap.get(tracking) || []), order.id]);
      }
      if (!orders || orders.length < 1000) break;
    }

    const existing = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data: links, error } = await supabase.from('order_invoice_links')
        .select('order_id, quickbooks_invoice_id').range(from, from + 999);
      if (error) throw error;
      for (const link of links || []) existing.add(`${link.order_id}:${link.quickbooks_invoice_id}`);
      if (!links || links.length < 1000) break;
    }

    let invoicesScanned = 0;
    let linkedCount = 0;
    let alreadyLinkedCount = 0;
    let unmatchedCount = 0;
    let ambiguousCount = 0;

    for (let start = 1; ; start += 1000) {
      const query = `SELECT * FROM Invoice STARTPOSITION ${start} MAXRESULTS 1000`;
      const response = await fetch(`${QB}/${token.company_id}/query?query=${encodeURIComponent(query)}&minorversion=65`, {
        headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.Fault?.Error?.[0]?.Detail || `QuickBooks invoice query failed (${response.status})`);
      const invoices = body.QueryResponse?.Invoice || [];
      invoicesScanned += invoices.length;

      const pendingLinks: any[] = [];
      for (const invoice of invoices) {
        const descriptions = (invoice.Line || [])
          .map((line: any) => String(line.Description || ''))
          .join('\n');
        const references = [...new Set((descriptions.match(/CCC[A-Z0-9]+/gi) || []).map((value: string) => value.toUpperCase()))];
        let invoiceMatched = false;
        let invoiceAmbiguous = false;
        for (const reference of references) {
          const orderIds = orderMap.get(reference) || [];
          if (orderIds.length > 1) {
            invoiceAmbiguous = true;
            continue;
          }
          if (orderIds.length !== 1) continue;
          invoiceMatched = true;
          const key = `${orderIds[0]}:${invoice.Id}`;
          if (existing.has(key)) {
            alreadyLinkedCount++;
            continue;
          }
          pendingLinks.push({
            order_id: orderIds[0],
            quickbooks_invoice_id: String(invoice.Id),
            quickbooks_invoice_number: invoice.DocNumber ? String(invoice.DocNumber) : null,
            quickbooks_invoice_url: `https://qbo.intuit.com/app/invoice?txnId=${invoice.Id}`,
            invoice_date: invoice.TxnDate || null,
            link_source: 'quickbooks_sync',
            updated_at: new Date().toISOString(),
          });
          existing.add(key);
        }
        if (invoiceAmbiguous) ambiguousCount++;
        if (!invoiceMatched && !invoiceAmbiguous) unmatchedCount++;
      }

      if (pendingLinks.length > 0) {
        const { error } = await supabase.from('order_invoice_links')
          .upsert(pendingLinks, { onConflict: 'order_id,quickbooks_invoice_id' });
        if (error) throw error;
        linkedCount += pendingLinks.length;
      }
      if (invoices.length < 1000) break;
    }

    const result = {
      invoicesScanned,
      linkedCount,
      alreadyLinkedCount,
      unmatchedCount,
      ambiguousCount,
    };
    await supabase.from('order_invoice_sync_runs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      invoices_scanned: invoicesScanned,
      linked_count: linkedCount,
      already_linked_count: alreadyLinkedCount,
      unmatched_count: unmatchedCount,
      ambiguous_count: ambiguousCount,
    }).eq('id', runId);
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invoice sync failed';
    console.error('sync-order-invoices error:', message);
    if (runId) await supabase.from('order_invoice_sync_runs').update({
      status: 'failed', completed_at: new Date().toISOString(), error_message: message.slice(0, 1000),
    }).eq('id', runId);
    return json({ error: message }, 500);
  }
});