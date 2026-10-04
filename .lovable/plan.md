# Fix Route Profitability charts and the revenue check

## What each column means (Revenue check table)
- **On this page** = From invoices + Estimated + Paid via website. It's the total revenue the page counts for jobs on approved timeslips that month.
- **From invoices** = the real delivery amount (without VAT) taken from the job's linked QuickBooks invoice.
- **Estimated** = jobs with no invoice amount, priced from bike types or special rates.
- **Paid via website** = Shopify orders (estimated, since there's no invoice).
- **Invoiced in QuickBooks** = all collection and delivery invoiced in QuickBooks that month.
- **Not on a timeslip** = invoiced in QuickBooks but not matched to a job on an approved timeslip.

So "On this page" is always bigger than "Estimated", because it also includes website orders (and invoiced jobs, once amounts are filled in).

## Why QuickBooks shows nothing
Checked: of 5,932 invoice links, only 2 have a delivery amount saved. The links were made before the amount feature existed, and the last sync (19:06 today) ran before it was switched on, so the existing links were never updated. That's why "From invoices" and "Invoiced in QuickBooks" are near £0 and almost everything shows as estimated.

**Fix:** run a one-off refill that rereads every linked invoice from QuickBooks and saves its delivery amount, then make sure every future sync also updates amounts on links that already exist. After that, the two columns fill in.

## Why the monthly and yearly charts are empty (not confirmed yet)
Most likely they are timing out: since the switch to invoice-based pricing, the year view works out each of the ~840 timeslips one by one, each doing its own order lookups, and the revenue check table now does the same work again at the same time. First step is to confirm this on the page; then:
- Look up each day's orders once and reuse them across the charts and the table.
- Work out timeslips in parallel batches instead of one by one.
- Show a "Working this out…" message and any error on the charts instead of a blank chart.

## Technical details
- `sync-order-invoices`: add `refillAmounts` mode / always upsert `transport_net_amount` for existing keys (upsert already includes it — rerun suffices once deployed; add a check that amounts were written).
- Check the QB item names actually match `/collection\s*(and|&)\s*delivery/i`; if not, widen the match so amounts aren't saved as 0.
- `profitabilityService.ts`: per-date memo for `fetchOrdersForDate`, `Promise.all` in chunks of ~10 in `calculateWeeklyProfitabilityForMonth`, `calculateMonthlyProfitabilityForYear`, `getMonthlyReconciliation`; remove the noisy `console.log` in `getTotalJobs`.
- Charts: show loading/error states from React Query.
