# Real costs: driver pay + fuel + van maintenance

## What changes
Route Profitability currently works out cost as driver pay plus a guessed 45p per mile. The guess goes, and real costs take its place:

- **Driver pay** — from approved timeslips (already counted).
- **Fuel** — from the fuel invoices you upload on the Fuel page (net, excluding VAT). Each transaction is already matched to a van.
- **Van maintenance** — from the maintenance logs on the Vehicles page (the cost field on each maintenance entry).

## How fuel and maintenance are spread over jobs
- For each van and each month, the actual fuel (net) and maintenance cost is divided by the miles that van drove that month (from approved timeslips) to get that van's real cost per mile for the month.
- A job's cost = driver pay for the day + that job's miles × the van's cost per mile for that month.
- Months where you haven't uploaded a fuel invoice yet show no fuel cost — upload the invoices and the figures fill in. Same for maintenance entries.
- Timeslips with no van assigned count driver pay only.

## Keeping the old estimate as an option
The 45p flat rate stays as a clearly-labelled "Estimate (flat rate)" toggle, off by default, so you can compare. The cost note under the numbers changes from "driver pay + mileage at £0.45/mile" to explain the real-cost basis.

## Also in this change
- "Cost per mile" shown on the page becomes the real blended figure for the period, not the flat rate.
- Revenue check column labels clarified (from the earlier question): "From invoices" → "Invoiced (jobs on this page)"; "Invoiced in QuickBooks" → "All transport invoiced in QuickBooks", with a one-line note that QuickBooks includes invoiced work the page can't see (days with no approved timeslip, unlinked invoices).

## Technical details
- `profitabilityService.ts`: new loaders for `fuel_transactions` (trx_date, vehicle_id, net_amount) and `vehicle_maintenance_logs` (service_date, vehicle_id, cost); both are admin-readable already. Build a per-vehicle, per-month cost-per-mile map from approved timeslips' vehicle_id, mileage and date; pass it into `calculateProfitability` alongside a `costMode` flag ('actual' | 'flat'). Flat mode keeps the current `costPerMile` path unchanged.
- `RouteProfitabilityPage.tsx`: cost mode toggle (actual default), keep the flat rate input for estimate mode, wire the new rate map through the existing query hooks (add to query keys).
- `UnitEconomicsCard.tsx`: cost-basis note text per mode; show real cost per mile.
- `RevenueReconciliationCard.tsx`: column relabels + note line.
- No database changes needed — all data already exists.
