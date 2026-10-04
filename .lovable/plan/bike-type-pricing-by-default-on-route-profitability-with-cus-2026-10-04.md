# Bike-type pricing by default on Route Profitability, with customer special rates

## What changes
- The page opens with bike-type pricing switched **on**: revenue comes from each job's real bikes, not £32 per job.
- The £32 box stays as the fallback for when bike-type pricing is off, and its label will say so.

## Special flat rates (e.g. Matthew Coulthard)
- A customer with a special flat price on their account is always charged that flat price, whatever bike type they send. Bike-type pricing is skipped for them.
- Matthew Coulthard (MYNEXTBIKE Ltd) is the only customer with a special price saved: £65 per bike for collection and delivery (£32.50 per trip, per bike).
- **Big bikes for Matthew: £150.** A new "big bike rate price" field is added to customer accounts, and £150 saved on Matthew's. When a job has the big-bike flag switched on (the same flag the QuickBooks invoice uses), the big-bike price is used instead of the £65 — £75 per trip, per bike.
- Jobs using a special rate or big-bike rate get a small note on the per-job figures, so you can see which jobs used a flat price.

## Things to check with you
- Only Matthew has a special price saved. If other customers have a special rate in QuickBooks but no price on their account, they'll be priced by bike type. Tell me who they are and I'll add their prices.
- The big-bike flag is set by hand on each job (Large Bike Rate switch on the order page). If a big Matthew job isn't flagged, it'll price at £65.

## Technical details
- Migration: `ALTER TABLE profiles ADD COLUMN large_bike_rate_price numeric` (nullable); set 150 for Matthew Coulthard's profile.
- `profitabilityService.ts`: extend `getSpecialRatePrice` cache to also fetch `large_bike_rate_price`; in `getRevenueForTimeslip`/`getRevenuePerStopForOrder`, when a special rate exists and `order.use_large_bike_rate` is true and a large-bike price exists, use `large_bike_rate_price / 2 * qty * legs` instead of `special_rate_price / 2`. Count jobs priced by special/big-bike rate and expose for the note.
- `RouteProfitabilityPage.tsx`: `useBikeTypePricing` starts `true`; relabel the £32 input "Fallback per job (bike-type pricing off)".
- `EditUserDialog.tsx`: add a "Big bike rate price" field next to the existing special rate price so admins can set it per account.
