# Make Route Profitability unit economics accurate

## What's wrong today

Mostly right, but four things skew the numbers:

1. **Draft timeslips are counted.** All 48 drafts this year (579 stops, 712 jobs) go into revenue, but 47 of them have no mileage yet, so their fuel cost shows as £0. Profit per stop and per mile come out too high.
2. **"Per stop" is really "per address".** Revenue is counted per job (9,773 this year), but it's divided by stops (8,332), and several jobs at one address count as one stop. Revenue per stop comes out about 17% too high next to the job count.
3. **The year view will soon miss timeslips.** The year loads every timeslip in one go, and the system only returns 1,000 rows. 2026 has 843 so far, so by about December the Year tab will quietly leave the latest days out.
4. **A driver doing both legs of an order on the same day** is only paid for one leg in the bike-type pricing, so revenue on those days is a bit too low.

## Changes

- Only count **approved** timeslips in the unit economics and the week, month and year totals. Drafts show as "X draft timeslips not included" so you know they're waiting.
- Show **both per job and per stop**: Revenue, Cost and Profit per job (the main figure) plus per stop (per address visited), each labelled clearly.
- Load month and year timeslips in pages so nothing gets cut off at 1,000.
- Count revenue for each leg the driver actually did, so a collection and a delivery on the same day both count.
- Add a short note under the card: "Costs = driver pay + mileage at £X/mile. Van, insurance and overheads not included."

## Technical details

- `profitabilityService.ts`: add `.eq('status','approved')` to `getTimeslipsForDate/Week/Month/Year` (or filter client-side and return a draft count); wrap month/year in a `.range()` loop.
- `calculateUnitEconomics`: add `totalJobs` (sum of `getTotalJobs`) and per-job metrics; keep per-stop using `total_stops`.
- `getRevenueForTimeslip`: count once per matched leg (pickup/delivery driver match) instead of once per order.
- `UnitEconomicsCard.tsx`: per-job rows, per-stop rows, draft note, cost basis note.
