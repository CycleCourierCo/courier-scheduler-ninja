# Inspection totals and account details

## Repair totals

The "Total repairs" figure currently only counts repairs the customer has already approved, so a bike awaiting approval shows £0.00. Replace that single badge with three, shown whenever priced issues exist (not just for admins with approvals):

- Total parts — sum of all parts prices on the inspection
- Total labour — sum of all labour prices
- Total repairs — combined total of everything quoted

These cover every issue on the inspection regardless of approval state, so staff can see the value of the work before any decision is made. The existing approved/declined/receiver-approved counts stay as they are, and a separate "Approved: £x" figure is kept alongside so the billable amount is still visible at a glance.

Where an older issue has only a single price and no parts/labour split, the split badges account for it in the combined total so the numbers always add up.

## Account on each inspection

Each inspection card will show which account the bike belongs to, directly under the bike name:

- Business/customer account name (company name where set, otherwise their name or email)
- A "Shopify" badge when the job came from a Shopify store, so those jobs are instantly recognisable
- An "API" badge for jobs created through the integration, and walk-in inspections keep showing the walk-in customer's details as now

## Technical detail

- `src/pages/BicycleInspections.tsx` around lines 1631-1645: add `totalPartsCost`, `totalLabourCost` and `totalQuotedCost` derived from every issue in `orderIssues` (`parts_cost`, `labour_cost`, falling back to `estimated_cost` when no split exists); keep `totalRepairCost` for the approved figure.
- Badges block at lines 1955-1974: render Parts/Labour/Total quoted badges gated on `orderIssues.length > 0` rather than approval, keeping the admin-only approved total.
- `src/services/inspectionService.ts` `getPendingInspections`: add `shopify_order_id` and `created_via_api` to the orders select and pass them through on each row (`booking_customer_name` is already provided).
- Card header (near lines 1693-1742): render the account name plus Shopify/API badges; workshop-only rows keep their current walk-in description.
