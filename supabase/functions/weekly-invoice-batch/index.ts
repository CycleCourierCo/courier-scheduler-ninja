// Weekly invoice batch: replicates the "Create All Invoices" button on the
// Invoices page. Invoked by the Monday 01:00 UTC cron job (or manually via
// the X-Cron-Secret header). Returns 202 immediately and processes the batch
// in the background via EdgeRuntime.waitUntil so pg_net never times out.
// Per-customer invoices are created with bounded parallelism (concurrency 5).
// Run status/counts are persisted to public.weekly_invoice_batch_logs.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const REPORT_RECIPIENT = 'info@cyclecourierco.com';
const REPORT_FROM = 'CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>';
const CONCURRENCY = 3;

// ---- Report email (direct Resend, with persisted outcome) ----
async function sendReportEmail(
  supabase: any,
  logId: string,
  subject: string,
  html: string,
): Promise<void> {
  const persist = (fields: Record<string, unknown>) =>
    supabase.from('weekly_invoice_batch_logs').update(fields).eq('id', logId);

  if (!RESEND_API_KEY) {
    console.error('[weekly-invoice-batch] RESEND_API_KEY missing, cannot send report');
    await persist({
      report_status: 'failed',
      report_error: 'RESEND_API_KEY is not configured',
      report_recipient: REPORT_RECIPIENT,
    });
    return;
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: REPORT_FROM,
        to: [REPORT_RECIPIENT],
        reply_to: 'Info@cyclecourierco.com',
        subject,
        html,
      }),
    });

    const bodyText = await resp.text();
    if (!resp.ok) {
      console.error(`[weekly-invoice-batch] report email failed [${resp.status}]: ${bodyText}`);
      await persist({
        report_status: 'failed',
        report_http_status: resp.status,
        report_error: bodyText.slice(0, 2000),
        report_recipient: REPORT_RECIPIENT,
      });
      return;
    }

    console.log(`[weekly-invoice-batch] report email sent (${bodyText.slice(0, 200)})`);
    await persist({
      report_status: 'sent',
      report_http_status: resp.status,
      report_error: null,
      report_sent_at: new Date().toISOString(),
      report_recipient: REPORT_RECIPIENT,
    });
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error('[weekly-invoice-batch] report email threw:', msg);
    await persist({
      report_status: 'failed',
      report_error: msg.slice(0, 2000),
      report_recipient: REPORT_RECIPIENT,
    });
  }
}


// ---- Date helpers (Europe/London week Mon 00:00 → Sun 23:59:59.999) ----
function londonOffsetMinutes(date: Date): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return (asUTC - date.getTime()) / 60000;
}

function previousLondonWeekRange(now = new Date()): { start: Date; end: Date; label: string } {
  const offsetMin = londonOffsetMinutes(now);
  const nowLondon = new Date(now.getTime() + offsetMin * 60000);
  const dow = nowLondon.getUTCDay();
  const daysSinceMonday = (dow + 6) % 7;
  const thisMondayLondon = new Date(Date.UTC(
    nowLondon.getUTCFullYear(),
    nowLondon.getUTCMonth(),
    nowLondon.getUTCDate() - daysSinceMonday,
    0, 0, 0, 0,
  ));
  const prevMondayLondon = new Date(thisMondayLondon.getTime() - 7 * 86400_000);
  const prevSundayEndLondon = new Date(thisMondayLondon.getTime() - 1);

  const toUTC = (londonWall: Date) => {
    const guessUTC = new Date(londonWall.getTime() - offsetMin * 60000);
    const guessOffset = londonOffsetMinutes(guessUTC);
    return new Date(londonWall.getTime() - guessOffset * 60000);
  };

  const start = toUTC(prevMondayLondon);
  const end = toUTC(prevSundayEndLondon);

  // Match the InvoicesPage button format: "MMM d to MMM d, yyyy"
  // (e.g. "Nov 10 to Nov 16, 2025") so the report subject/body is identical.
  const fmtShort = (d: Date) => new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London', month: 'short', day: 'numeric',
  }).format(d);
  const fmtLong = (d: Date) => new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London', month: 'short', day: 'numeric', year: 'numeric',
  }).format(d);
  return { start, end, label: `${fmtShort(start)} to ${fmtLong(end)}` };
}

// ---- Bounded parallel runner (concurrency limit) ----
async function runPool<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

// ---- Report HTML ----
function buildReportHtml(args: {
  rangeLabel: string;
  successful: any[];
  failed: any[];
  skipped: any[];
  eligibleCount: number;
  allOrders: any[];
  missingProducts: { product: string; customerName: string }[];
}): string {
  const {
    rangeLabel, successful, failed, skipped, eligibleCount, allOrders, missingProducts,
  } = args;

  const delivered = allOrders.filter((o) => o.status === 'delivered');
  const collected = allOrders.filter(
    (o) => o.sender_confirmed_at || o.status === 'collected' || o.status === 'in_transit' || o.status === 'delivered',
  );

  const times = delivered
    .filter((o) => o.created_at && o.tracking_events?.shipday?.updates)
    .map((o) => {
      const createdAt = new Date(o.created_at);
      const updates = o.tracking_events.shipday.updates as any[];
      const del = updates?.find((u) => u.event === 'ORDER_COMPLETED');
      const col = updates?.find((u) => u.event === 'ORDER_POD_UPLOAD');
      if (!del) return null;
      const deliveredAt = new Date(del.timestamp);
      const creationToDelivery = (deliveredAt.getTime() - createdAt.getTime()) / 3_600_000;
      let collectionToDelivery: number | null = null;
      if (col) {
        collectionToDelivery = (deliveredAt.getTime() - new Date(col.timestamp).getTime()) / 3_600_000;
      }
      return { creationToDelivery, collectionToDelivery };
    })
    .filter((t): t is { creationToDelivery: number; collectionToDelivery: number | null } => t !== null);

  const avgCreationToDelivery = times.length
    ? times.reduce((s, t) => s + t.creationToDelivery, 0) / times.length : 0;
  const withCol = times.filter((t) => t.collectionToDelivery !== null);
  const avgCollectionToDelivery = withCol.length
    ? withCol.reduce((s, t) => s + (t.collectionToDelivery as number), 0) / withCol.length : 0;

  const uniqueMissing = [...new Set(missingProducts.map((m) => m.product))];
  const customersForProduct = (product: string) => {
    const names = missingProducts.filter((m) => m.product === product).map((m) => m.customerName);
    return [...new Set(names)].join(', ');
  };

  const totalBikesInvoiced = successful.reduce((s, i) => s + (i.bikeCount || 0), 0);
  const totalBikesSkipped = successful.reduce((s, i) => s + (i.skippedBikes || 0), 0);

  return `
    <h2>Invoice Batch Creation Report (Weekly Cron)</h2>
    <p><strong>Date Range:</strong> ${rangeLabel}</p>

    <h3>Summary</h3>
    <ul>
      <li>Successful Invoices: ${successful.length}</li>
      <li>Failed Invoices: ${failed.length}</li>
      <li>Skipped Customers: ${skipped.length}</li>
      <li>Total Customers Processed: ${eligibleCount}</li>
    </ul>

    <h3>Order &amp; Bike Statistics</h3>
    <ul>
      <li>Total Orders Included in Invoices: ${allOrders.length}</li>
      <li>Total Bikes Invoiced: ${totalBikesInvoiced}</li>
      ${totalBikesSkipped > 0 ? `<li style="color:#dc2626;">Bikes Skipped (Missing Products): ${totalBikesSkipped}</li>` : ''}
      <li>Total Orders from Skipped Customers: ${skipped.reduce((s, c) => s + (c.orderCount || 0), 0)}</li>
      <li>Delivered Orders: ${delivered.length}</li>
      <li>Collected Orders: ${collected.length}</li>
      <li>Average Creation to Delivery: ${avgCreationToDelivery.toFixed(1)} hours</li>
      <li>Average Collection to Delivery: ${avgCollectionToDelivery.toFixed(1)} hours</li>
    </ul>

    ${uniqueMissing.length > 0 ? `
      <h3 style="color:#dc2626;">⚠️ Missing QuickBooks Products (Bike Types)</h3>
      <p>The following bike types could not be matched to QuickBooks products and were excluded from invoices:</p>
      <table border="1" cellpadding="8" cellspacing="0" style="background-color:#fee2e2;">
        <tr><th>Bike Type</th><th>Affected Customers</th></tr>
        ${uniqueMissing.map((p) => `<tr><td>${p}</td><td>${customersForProduct(p)}</td></tr>`).join('')}
      </table>
      <p><strong>Action Required:</strong> Create these products in QuickBooks with the naming format:<br>
      "Collection and Delivery within England and Wales - [Bike Type]"</p>
    ` : '<p style="color:#16a34a;">✓ All bike types matched to QuickBooks products</p>'}

    <h3>Successful Invoices</h3>
    ${successful.length > 0 ? `
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><th>Customer</th><th>Email</th><th>Orders</th><th>Bikes</th><th>Invoice #</th></tr>
        ${successful.map((i) => `
          <tr>
            <td>${i.customerName}</td>
            <td>${i.customerEmail}</td>
            <td>${i.orderCount}</td>
            <td>${i.bikeCount}${i.skippedBikes > 0 ? ` <span style="color:#dc2626;">(${i.skippedBikes} skipped)</span>` : ''}</td>
            <td>${i.invoiceNumber || 'N/A'}</td>
          </tr>`).join('')}
      </table>` : '<p>No successful invoices</p>'}

    <h3>Failed Invoices</h3>
    ${failed.length > 0 ? `
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><th>Customer</th><th>Email</th><th>Error</th></tr>
        ${failed.map((i) => `<tr><td>${i.customerName}</td><td>${i.customerEmail}</td><td>${i.error}</td></tr>`).join('')}
      </table>` : '<p>No failed invoices</p>'}

    <h3>Skipped Customers</h3>
    ${skipped.length > 0 ? `
      <table border="1" cellpadding="8" cellspacing="0" style="background-color:#fff3cd;">
        <tr><th>Customer</th><th>Email</th><th>Orders in Range</th><th>Reason</th></tr>
        ${skipped.map((c) => `<tr><td>${c.customerName}</td><td>${c.customerEmail}</td><td>${c.orderCount}</td><td>${c.reason}</td></tr>`).join('')}
      </table>
      <p><strong>Note:</strong> These customers were excluded from invoice creation. To include them, add an accounts email address in User Management.</p>
    ` : '<p>No customers were skipped</p>'}
  `;
}

// ---- Background batch processor ----
async function processBatch(params: {
  logId: string;
  start: Date;
  end: Date;
  label: string;
}) {
  const { logId, start, end, label } = params;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const invoiceUrl = `${SUPABASE_URL}/functions/v1/create-quickbooks-invoice`;

  try {
    console.log(`[weekly-invoice-batch] range ${start.toISOString()} → ${end.toISOString()} (${label})`);

    const { data: customers, error: custErr } = await supabase
      .from('profiles')
      .select('id, name, email, accounts_email')
      .eq('role', 'b2b_customer')
      .eq('account_status', 'approved')
      .order('name');
    if (custErr) throw custErr;

    const eligible = (customers || []).filter((c: any) => c.accounts_email);
    const withoutEmail = (customers || []).filter((c: any) => !c.accounts_email);

    const successful: any[] = [];
    const failed: any[] = [];
    const skipped: any[] = [];
    const allOrders: any[] = [];
    const missingProducts: { product: string; customerName: string }[] = [];

    await supabase
      .from('weekly_invoice_batch_logs')
      .update({ eligible_count: eligible.length })
      .eq('id', logId);

    // Parallel per-customer invoice creation (bounded concurrency).
    await runPool(eligible, CONCURRENCY, async (customer: any) => {
      try {
        const { data: orders, error: ordersErr } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', customer.id)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .neq('status', 'cancelled');
        if (ordersErr) throw ordersErr;

        if (!orders || orders.length === 0) {
          skipped.push({
            customerName: customer.name,
            customerEmail: customer.accounts_email || customer.email,
            reason: 'No orders in date range',
            orderCount: 0,
          });
          return;
        }

        allOrders.push(...orders);

        const resp = await fetch(invoiceUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cron-Secret': CRON_SECRET,
          },
          body: JSON.stringify({
            customerId: customer.id,
            customerEmail: customer.accounts_email,
            customerName: customer.name,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            orders,
          }),
        });

        if (!resp.ok) {
          const text = await resp.text();
          let friendly = `create-quickbooks-invoice ${resp.status}`;
          try {
            const parsed = JSON.parse(text);
            if (parsed?.error) friendly = String(parsed.error);
          } catch { friendly = `${friendly}: ${text}`; }
          throw new Error(friendly);
        }
        const data = await resp.json();

        if (Array.isArray(data?.missingProducts)) {
          for (const p of data.missingProducts) {
            missingProducts.push({ product: p, customerName: customer.name });
          }
        }

        successful.push({
          customerName: customer.name,
          customerEmail: customer.accounts_email,
          orderCount: orders.length,
          bikeCount: data?.stats?.bikeCount || orders.length,
          skippedBikes: data?.stats?.skippedBikes || 0,
          invoiceNumber: data?.stats?.invoiceNumber || data?.invoice_number,
          missingProducts: data?.missingProducts || [],
        });
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        console.error(`[weekly-invoice-batch] ${customer.name} failed:`, errorMsg);
        failed.push({
          customerName: customer.name,
          customerEmail: customer.accounts_email || customer.email,
          error: errorMsg,
        });

        // Persist failure to invoice_history so it's visible after the fact.
        try {
          await supabase.from('invoice_history').insert({
            user_id: customer.id,
            customer_id: customer.id,
            customer_name: customer.name,
            customer_email: customer.accounts_email || customer.email,
            start_date: start.toISOString(),
            end_date: end.toISOString(),
            order_count: 0,
            total_amount: 0,
            status: 'failed',
            error_message: errorMsg,
          });
        } catch (logErr) {
          console.error('[weekly-invoice-batch] failed to log invoice failure:', logErr);
        }
      }
    });

    // Skipped: customers with orders but no accounts_email.
    await runPool(withoutEmail, CONCURRENCY, async (customer: any) => {
      const { data: rows } = await supabase
        .from('orders').select('id')
        .eq('user_id', customer.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .neq('status', 'cancelled');
      skipped.push({
        customerName: customer.name,
        customerEmail: customer.email || 'No email',
        reason: 'Missing accounts email',
        orderCount: rows?.length || 0,
      });
    });

    // Run log first, so the report reflects the persisted counters.
    await supabase.from('weekly_invoice_batch_logs').update({
      run_completed_at: new Date().toISOString(),
      status: 'completed',
      successful_count: successful.length,
      failed_count: failed.length,
      skipped_count: skipped.length,
      eligible_count: eligible.length,
    }).eq('id', logId);

    // Report email (outcome persisted on the run log).
    const html = buildReportHtml({
      rangeLabel: label,
      successful, failed, skipped,
      eligibleCount: eligible.length,
      allOrders,
      missingProducts,
    });
    await sendReportEmail(supabase, logId, `Invoice Batch Report - ${label}`, html);

    console.log(`[weekly-invoice-batch] done: ${successful.length} ok, ${failed.length} failed, ${skipped.length} skipped`);
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error('[weekly-invoice-batch] fatal:', errorMsg);
    try {
      await supabase.from('weekly_invoice_batch_logs').update({
        run_completed_at: new Date().toISOString(),
        status: 'failed',
        error_message: errorMsg,
      }).eq('id', logId);
    } catch (_) { /* noop */ }
    // Always send something, even on a fatal error.
    try {
      await sendReportEmail(
        supabase,
        logId,
        `Invoice Batch FAILED - ${label}`,
        `<h2>Invoice Batch Creation Failed (Weekly Cron)</h2>
         <p><strong>Date Range:</strong> ${label}</p>
         <p>The batch stopped with an error before completing. No further invoices were created in this run.</p>
         <p><strong>Error:</strong> ${errorMsg}</p>`,
      );
    } catch (_) { /* noop */ }
  }

}

// ---- Rebuild + re-send the report for an existing run (no invoices created) ----
async function resendReport(logId?: string): Promise<{ logId: string; label: string }> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let query = supabase
    .from('weekly_invoice_batch_logs')
    .select('id, range_start, range_end, range_label, run_started_at, run_completed_at, eligible_count')
    .order('run_started_at', { ascending: false })
    .limit(1);
  if (logId) query = supabase
    .from('weekly_invoice_batch_logs')
    .select('id, range_start, range_end, range_label, run_started_at, run_completed_at, eligible_count')
    .eq('id', logId)
    .limit(1);

  const { data: rows, error } = await query;
  if (error) throw error;
  const run = rows?.[0];
  if (!run) throw new Error('No batch run found to report on');

  const start = new Date(run.range_start);
  const end = new Date(run.range_end);
  const label = run.range_label || `${start.toDateString()} to ${end.toDateString()}`;

  // Invoice attempts recorded during that run window.
  const windowStart = new Date(new Date(run.run_started_at).getTime() - 60_000).toISOString();
  const windowEnd = new Date(
    (run.run_completed_at ? new Date(run.run_completed_at).getTime() : Date.now()) + 10 * 60_000,
  ).toISOString();

  const { data: history } = await supabase
    .from('invoice_history')
    .select('customer_id, customer_name, customer_email, order_count, status, quickbooks_invoice_number, error_message')
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd);

  const successful = (history || [])
    .filter((h: any) => h.status !== 'failed')
    .map((h: any) => ({
      customerName: h.customer_name,
      customerEmail: h.customer_email,
      orderCount: h.order_count || 0,
      bikeCount: h.order_count || 0,
      skippedBikes: 0,
      invoiceNumber: h.quickbooks_invoice_number,
    }));
  const failed = (history || [])
    .filter((h: any) => h.status === 'failed')
    .map((h: any) => ({
      customerName: h.customer_name,
      customerEmail: h.customer_email,
      error: h.error_message || 'Unknown error',
    }));

  // Orders in range for the customers that were invoiced (for the stats block).
  const invoicedIds = [...new Set((history || [])
    .filter((h: any) => h.status !== 'failed')
    .map((h: any) => h.customer_id)
    .filter(Boolean))];
  let allOrders: any[] = [];
  if (invoicedIds.length > 0) {
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .in('user_id', invoicedIds)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .neq('status', 'cancelled');
    allOrders = orders || [];
  }

  const html = buildReportHtml({
    rangeLabel: label,
    successful,
    failed,
    skipped: [],
    eligibleCount: run.eligible_count || successful.length + failed.length,
    allOrders,
    missingProducts: [],
  }) + '<p><em>This is a re-sent copy of the report rebuilt from the stored run records.</em></p>';

  await sendReportEmail(supabase, run.id, `Invoice Batch Report - ${label}`, html);
  return { logId: run.id, label };
}

// ---- Handler ----
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const cronHeader = req.headers.get('X-Cron-Secret');
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let authorized = false;
  let triggeredBy = 'cron';

  if (cronHeader && CRON_SECRET && cronHeader === CRON_SECRET) {
    authorized = true;
    triggeredBy = 'cron';
  } else {
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase
          .from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role === 'admin') {
          authorized = true;
          triggeredBy = `admin:${user.email ?? user.id}`;
        }
      }
    }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    let body: any = {};
    try { body = await req.json(); } catch (_) { /* empty body */ }

    const { start, end, label } = body?.startDate && body?.endDate
      ? {
          start: new Date(body.startDate),
          end: new Date(body.endDate),
          label: `${new Date(body.startDate).toDateString()} to ${new Date(body.endDate).toDateString()}`,
        }
      : previousLondonWeekRange();

    // Insert a run log row up front so we always have a record, even if the
    // background task dies.
    const { data: logRow, error: logErr } = await supabase
      .from('weekly_invoice_batch_logs')
      .insert({
        range_start: start.toISOString(),
        range_end: end.toISOString(),
        range_label: label,
        status: 'running',
        triggered_by: triggeredBy,
      })
      .select('id')
      .single();

    if (logErr || !logRow) {
      console.error('[weekly-invoice-batch] failed to insert run log:', logErr);
      return new Response(JSON.stringify({ error: 'Failed to create run log' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fire-and-forget background processing so pg_net returns immediately.
    // @ts-ignore EdgeRuntime is provided by Supabase Edge Runtime.
    EdgeRuntime.waitUntil(processBatch({ logId: logRow.id, start, end, label }));

    return new Response(JSON.stringify({
      accepted: true,
      logId: logRow.id,
      range: { start: start.toISOString(), end: end.toISOString(), label },
    }), { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('[weekly-invoice-batch] handler error:', err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
