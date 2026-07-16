// Weekly invoice batch: replicates the "Create All Invoices" button on the
// Invoices page. Invoked by the Monday 01:00 UTC cron job (or manually via
// the X-Cron-Secret header). For every approved b2b_customer with an
// accounts_email, it fetches non-cancelled orders created in the previous
// Monday–Sunday window (Europe/London) and calls create-quickbooks-invoice
// per customer, then emails the same HTML report to info@cyclecourierco.com.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

// ---- Date helpers (Europe/London week Mon 00:00 → Sun 23:59:59.999) ----
function londonOffsetMinutes(date: Date): number {
  // Approximation via Intl: get the London wall time, compare against UTC.
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
  return (asUTC - date.getTime()) / 60000; // minutes London is ahead of UTC
}

function previousLondonWeekRange(now = new Date()): { start: Date; end: Date; label: string } {
  // Convert "now" to London wall clock, find this Monday 00:00 London, subtract 7 days.
  const offsetMin = londonOffsetMinutes(now);
  const nowLondon = new Date(now.getTime() + offsetMin * 60000);
  const dow = nowLondon.getUTCDay(); // 0 Sun .. 6 Sat, in London wall clock
  const daysSinceMonday = (dow + 6) % 7; // Monday-based
  const thisMondayLondon = new Date(Date.UTC(
    nowLondon.getUTCFullYear(),
    nowLondon.getUTCMonth(),
    nowLondon.getUTCDate() - daysSinceMonday,
    0, 0, 0, 0,
  ));
  const prevMondayLondon = new Date(thisMondayLondon.getTime() - 7 * 86400_000);
  const prevSundayEndLondon = new Date(thisMondayLondon.getTime() - 1); // 23:59:59.999 previous Sunday

  // Convert London wall-clock instants back to real UTC instants using the
  // offset that applies on each side (handles BST boundaries within the week).
  const toUTC = (londonWall: Date) => {
    // londonWall was built from UTC components representing London wall time.
    // We need a UTC instant such that its London wall time equals londonWall.
    const guessUTC = new Date(londonWall.getTime() - offsetMin * 60000);
    const guessOffset = londonOffsetMinutes(guessUTC);
    return new Date(londonWall.getTime() - guessOffset * 60000);
  };

  const start = toUTC(prevMondayLondon);
  const end = toUTC(prevSundayEndLondon);

  const fmt = (d: Date) => new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric',
  }).format(d);
  return { start, end, label: `${fmt(start)} to ${fmt(end)}` };
}

// ---- Report HTML (mirror of InvoicesPage handleCreateAllInvoices) ----
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

// ---- Handler ----
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Auth: require X-Cron-Secret (cron) OR admin JWT.
  const cronHeader = req.headers.get('X-Cron-Secret');
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let authorized = false;

  if (cronHeader && CRON_SECRET && cronHeader === CRON_SECRET) {
    authorized = true;
  } else {
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase
          .from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role === 'admin') authorized = true;
      }
    }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Optional body override for manual re-runs of an older week.
    let body: any = {};
    try { body = await req.json(); } catch (_) { /* empty body */ }

    const { start, end, label } = body?.startDate && body?.endDate
      ? {
          start: new Date(body.startDate),
          end: new Date(body.endDate),
          label: `${new Date(body.startDate).toDateString()} to ${new Date(body.endDate).toDateString()}`,
        }
      : previousLondonWeekRange();

    console.log(`[weekly-invoice-batch] range ${start.toISOString()} → ${end.toISOString()} (${label})`);

    // Eligible customers (matches Invoices page query).
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

    const invoiceUrl = `${SUPABASE_URL}/functions/v1/create-quickbooks-invoice`;

    for (const customer of eligible) {
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
          continue;
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
          throw new Error(`create-quickbooks-invoice ${resp.status}: ${text}`);
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
        console.error(`[weekly-invoice-batch] ${customer.name} failed:`, err?.message);
        failed.push({
          customerName: customer.name,
          customerEmail: customer.accounts_email || customer.email,
          error: err?.message || String(err),
        });
      }
    }

    // Skipped: customers with orders but no accounts_email.
    for (const customer of withoutEmail) {
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
    }

    // Report email.
    try {
      const html = buildReportHtml({
        rangeLabel: label,
        successful, failed, skipped,
        eligibleCount: eligible.length,
        allOrders,
        missingProducts,
      });
      await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE}`,
        },
        body: JSON.stringify({
          to: 'info@cyclecourierco.com',
          subject: `Invoice Batch Report - ${label}`,
          html,
        }),
      });
    } catch (e) {
      console.error('[weekly-invoice-batch] report email failed:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      range: { start: start.toISOString(), end: end.toISOString(), label },
      counts: { successful: successful.length, failed: failed.length, skipped: skipped.length },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('[weekly-invoice-batch] fatal:', err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
