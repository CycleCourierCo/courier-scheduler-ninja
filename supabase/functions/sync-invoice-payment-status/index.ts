// Pulls payment state (total, balance, due date) for QuickBooks invoices into
// quickbooks_invoice_status: every open invoice in QuickBooks, plus any invoice
// the app knows about (invoice history / job links) that hasn't been checked or
// was open last time. Runs from cron (X-Cron-Secret) or by admin/CS staff.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { identifyCaller } from '../_shared/staffAuth.ts';
import { getQuickBooksToken } from '../_shared/quickbooksToken.ts';

const QB = 'https://quickbooks.api.intuit.com/v3/company';
const FIELDS = 'Id, DocNumber, TxnDate, DueDate, TotalAmt, Balance, CustomerRef';
const MAX_CHECK_PER_RUN = 4000;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type QbInvoice = { Id: string; DocNumber?: string; TxnDate?: string; DueDate?: string; TotalAmt?: number; Balance?: number; CustomerRef?: { value?: string; name?: string } };

async function qbQuery(token: { company_id: string; access_token: string }, query: string): Promise<QbInvoice[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${QB}/${token.company_id}/query?query=${encodeURIComponent(query)}&minorversion=65`, {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return (data?.QueryResponse?.Invoice || []) as QbInvoice[];
    }
    await res.body?.cancel();
    if (res.status === 429 || res.status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
    throw new Error(`QuickBooks query failed (${res.status})`);
  }
  throw new Error('QuickBooks is not responding');
}

const toRow = (inv: QbInvoice, now: string) => ({
  quickbooks_invoice_id: String(inv.Id),
  doc_number: inv.DocNumber ?? null,
  customer_name: inv.CustomerRef?.name ?? null,
  qb_customer_id: inv.CustomerRef?.value ?? null,
  txn_date: inv.TxnDate ?? null,
  due_date: inv.DueDate ?? null,
  total_amount: Number(inv.TotalAmt || 0),
  balance: Number(inv.Balance || 0),
  deleted: false,
  checked_at: now,
});

async function readAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error('Database read failed');
    out.push(...((data || []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const caller = await identifyCaller(req);
    if (!caller) return json({ error: 'Unauthorized' }, 401);
    if (caller.kind === 'user') {
      const allowed = ['admin', 'cs_agent'];
      let ok = caller.roles.some((r) => allowed.includes(r));
      if (!ok) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', caller.userId).maybeSingle();
        ok = allowed.includes(String(p?.role || ''));
      }
      if (!ok) return json({ error: 'Admin or customer service access required' }, 403);
    }

    const token = await getQuickBooksToken(supabase);
    if (!token) return json({ error: 'QuickBooks is not connected.' }, 400);
    const now = new Date().toISOString();

    // 1. Every invoice in QuickBooks that still has money owing.
    const open: QbInvoice[] = [];
    for (let start = 1; start < 50_000; start += 1000) {
      const page = await qbQuery(token, `SELECT ${FIELDS} FROM Invoice WHERE Balance > '0' STARTPOSITION ${start} MAXRESULTS 1000`);
      open.push(...page);
      if (page.length < 1000) break;
    }
    const openIds = new Set(open.map((i) => String(i.Id)));
    const rows = open.map((i) => toRow(i, now));

    // 2. Invoices the app knows about that need a check: never checked, or open last time but not now.
    const [history, links, known] = await Promise.all([
      readAll<{ quickbooks_invoice_id: string }>((f, t) => supabase.from('invoice_history').select('quickbooks_invoice_id').not('quickbooks_invoice_id', 'is', null).order('id').range(f, t)),
      readAll<{ quickbooks_invoice_id: string }>((f, t) => supabase.from('order_invoice_links').select('quickbooks_invoice_id').order('id').range(f, t)),
      readAll<{ quickbooks_invoice_id: string; balance: number; deleted: boolean }>((f, t) => supabase.from('quickbooks_invoice_status').select('quickbooks_invoice_id, balance, deleted').order('quickbooks_invoice_id').range(f, t)),
    ]);
    const knownMap = new Map(known.map((k) => [k.quickbooks_invoice_id, k]));
    const toCheck = new Set<string>();
    for (const r of [...history, ...links]) {
      const id = String(r.quickbooks_invoice_id || '');
      if (/^\d{1,20}$/.test(id) && !openIds.has(id) && !knownMap.has(id)) toCheck.add(id);
    }
    for (const k of known) {
      if (!k.deleted && Number(k.balance) > 0 && !openIds.has(k.quickbooks_invoice_id)) toCheck.add(k.quickbooks_invoice_id);
    }
    const checkList = [...toCheck].slice(0, MAX_CHECK_PER_RUN);
    for (let i = 0; i < checkList.length; i += 100) {
      const batch = checkList.slice(i, i + 100);
      const found = await qbQuery(token, `SELECT ${FIELDS} FROM Invoice WHERE Id IN (${batch.map((id) => `'${id}'`).join(',')}) MAXRESULTS 100`);
      const foundIds = new Set(found.map((f) => String(f.Id)));
      rows.push(...found.map((f) => toRow(f, now)));
      for (const id of batch) {
        if (!foundIds.has(id)) rows.push({ quickbooks_invoice_id: id, doc_number: null, customer_name: null, qb_customer_id: null, txn_date: null, due_date: null, total_amount: 0, balance: 0, deleted: true, checked_at: now });
      }
    }

    // Deleted rows keep any earlier number/customer: only overwrite the deleted flag and checked time.
    const deletedIds = rows.filter((r) => r.deleted).map((r) => r.quickbooks_invoice_id);
    const live = rows.filter((r) => !r.deleted);
    for (let i = 0; i < live.length; i += 500) {
      const { error } = await supabase.from('quickbooks_invoice_status').upsert(live.slice(i, i + 500), { onConflict: 'quickbooks_invoice_id' });
      if (error) throw new Error('Could not save invoice status');
    }
    for (let i = 0; i < deletedIds.length; i += 200) {
      const ids = deletedIds.slice(i, i + 200);
      const existing = ids.filter((id) => knownMap.has(id));
      const fresh = rows.filter((r) => r.deleted && ids.includes(r.quickbooks_invoice_id) && !knownMap.has(r.quickbooks_invoice_id));
      if (existing.length) {
        const { error } = await supabase.from('quickbooks_invoice_status').update({ deleted: true, balance: 0, checked_at: now }).in('quickbooks_invoice_id', existing);
        if (error) throw new Error('Could not save invoice status');
      }
      if (fresh.length) {
        const { error } = await supabase.from('quickbooks_invoice_status').upsert(fresh, { onConflict: 'quickbooks_invoice_id' });
        if (error) throw new Error('Could not save invoice status');
      }
    }

    console.log(`sync-invoice-payment-status: ${open.length} open, ${checkList.length} checked, ${deletedIds.length} missing, caller=${caller.kind}`);
    return json({
      ok: true,
      openCount: open.length,
      checkedCount: checkList.length,
      remaining: Math.max(0, toCheck.size - checkList.length),
      missingCount: deletedIds.length,
      checkedAt: now,
    });
  } catch (e) {
    console.error('sync-invoice-payment-status error:', e instanceof Error ? e.message : 'unknown');
    return json({ error: 'Could not check QuickBooks right now. Please try again shortly.' }, 500);
  }
});
