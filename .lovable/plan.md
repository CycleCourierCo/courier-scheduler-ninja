# Make Route Profitability revenue match real invoices

## What we know so far
- The page doesn't use your invoices at all. It **estimates** revenue from price-list bike prices (e.g. £60 a normal bike, halved per trip) for jobs on approved driver timeslips.
- Invoices raised through the portal total about **£400k** since Sept 2025 (1,386 invoices). That's close to your £368k QuickBooks income, but those invoices can include more than delivery (Box My Bike, guaranteed delivery, storage, inspections).
- Approved timeslips only start on 20 Oct 2025, and some days have no approved timeslip. Jobs done on those days get no revenue on the page, even though they were invoiced.
- Not confirmed yet: whether the price list (VAT included) matches what customers actually pay, and how much of the gap comes from discounts, special rates, card-paid customers or VAT.

## What I'll build
1. **Real invoiced revenue per job.** For each delivered job, take the delivery lines from its linked QuickBooks invoice (the tracking number is already on every line). Leave out repairs, inspections, storage, Box My Bike and guaranteed-delivery lines, so only transport income counts. Show it **net of VAT**, the same way QuickBooks reports income.
2. **Use it on the page.** Each timeslip's revenue = the real invoiced amount for the trips that driver did (split half collection, half delivery). If a job has no linked invoice yet, use the bike-type estimate and mark it "estimated".
3. **Show the mix.** The unit economics card says e.g. "£41,200 invoiced · £3,100 estimated (52 jobs not yet invoiced)", so you can see how real the figure is.
4. **Monthly check.** A small table on the page: transport revenue on the page vs. total transport invoiced in QuickBooks that month, plus a "not on a timeslip" figure for jobs invoiced but missing a timeslip. That should explain any gap against your £368k.

## Question for you after the first run
If the monthly check still shows a big gap, I'll list the biggest causes (missing timeslips, unlinked invoices, card-paid customers) before changing anything else.

## Technical details
- New service-role edge function (or extend `sync-order-invoices`) that reads QuickBooks invoice lines for linked invoices and saves per-order transport net amount into a new `order_invoice_links.transport_net_amount` column (product name filtered to "Collection and Delivery…" products), repeat-safe, paged.
- `profitabilityService.ts`: `getRevenueForTimeslip` prefers `transport_net_amount / 2 * legs`, falls back to `getRevenuePerStopForBikeType` (converted to net: /1.2) and counts estimated jobs.
- `UnitEconomicsCard.tsx`: invoiced vs estimated line; new monthly reconciliation table on `RouteProfitabilityPage.tsx`.
- Paged reads to avoid the 1,000-row limit.
