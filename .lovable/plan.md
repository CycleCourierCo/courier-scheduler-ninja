# Booked jobs on the Expiring Dates page

## What it shows

Today the page hides any job that has been booked (it has a scheduled pickup or delivery
date), so once you plan a job it disappears — even if the customer's own dates were
expiring or already expired. Staff lose the at-a-glance picture of whether the urgent
jobs are covered.

Each of the four columns (Last date today / Last date tomorrow / Last date in 2–3 days /
Expired) gets a **separate "Booked" section at the bottom**, under a small divider
heading with its own count. Jobs whose customer dates land in that column but which have
now been booked appear there, clearly marked:

- Card looks like the normal cards but dimmed, with a green "Booked for Sun 4 Oct" badge
  showing the scheduled date, instead of the days-left badge.
- Same info otherwise: tracking number, customer, bikes, leg badge, open-order link.
- The main list on top (not yet booked) stays exactly as it is, and the column heading
  count keeps counting only the not-yet-booked jobs — so the watch list stays honest.

Live data check: this surfaces 12 collection legs and 16 delivery legs today (8
deliveries and 3 collections with expired customer dates, plus the rest expiring
tomorrow or in 2–3 days).

## What counts as "booked"

- Collection leg: `scheduled_pickup_date` is set and the order isn't collected yet.
- Delivery leg: `scheduled_delivery_date` is set, order not delivered, and still not a
  Box My Bike / warehouse-storage order (same rule as now).
- The Northern Ireland exclusion and the never-gave-dates exclusion stay exactly as
  they are.
- The map keeps showing only the not-yet-booked jobs — booked work no longer needs
  chasing, so it stays off the map.

## Technical changes

**`src/pages/ExpiringDatesPage.tsx`** only.

- The query already selects `scheduled_pickup_date` / `scheduled_delivery_date`, so no
  new fetch. The `eligible` flag passed to `consider` becomes a three-way value
  (`'open' | 'booked' | 'skip'`):
  - collection: collected → skip; scheduled date set → 'booked'; else 'open'.
  - delivery: delivered / box / warehouse → skip; scheduled date set → 'booked'; else
    'open'.
- `ExpiringLeg` gains `booked: boolean` and `bookedDate: string | null` (normalised to a
  London `YYYY-MM-DD` string with the existing `londonDay` helper).
- Bucketing by `daysLeft` (from the customer's last chosen date) is unchanged — booked
  jobs go in the same column their dates belong to.
- Column rendering: after the existing list, if any booked legs landed in that column,
  render a divider row ("Booked" + count) and the booked cards (dimmed, green booked
  badge). Both sections sort soonest/most-overdue first as now.
- The empty-state message at the bottom ("No jobs with dates expiring…") now only
  triggers when there are neither open nor booked legs.

## Verification

- TypeScript check passes; build OK.
- Preview: columns show their open jobs on top and a Booked section at the bottom with
  counts matching the live data above; map unchanged.
