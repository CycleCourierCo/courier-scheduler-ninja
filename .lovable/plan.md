# Make bike-type pricing the default on Route Profitability

## What changes
- The page opens with "bike-type pricing" switched **on**, so revenue comes from each job's real bikes, not £32 per job.
- The £32 box stays, but only as the fallback when you switch bike-type pricing off. Its label will say that.

## Special rates (e.g. Matthew Coulthard)
- Customers who have a special flat price on their account are charged at that flat price, whatever bike type they send. Bike-type pricing is skipped for them.
- Matthew Coulthard (MYNEXTBIKE Ltd) is the only customer with a special price saved: £65 per bike for collection and delivery, so £32.50 for each trip. That's how it's already worked out when bike-type pricing is on. It'll now be used by default.
- Each bike on the order counts: 2 bikes = 2 x £32.50 per trip.
- Per-job figures will show a small "special rate" note, so you can see which jobs used a flat price.

## Things to check with you
- Only Matthew has a special price saved. If other customers have a special rate in QuickBooks but no price on their account, they'll be priced by bike type. Tell me who they are and I'll add their prices.
- The big-bike rate has no price saved on accounts, so big bikes for special-rate customers still use the normal special price.

## Technical details
- `RouteProfitabilityPage.tsx`: `useBikeTypePricing` starts as `true`; relabel the £32 input "Fallback per job (bike-type pricing off)".
- `profitabilityService.ts`: no change to the pricing logic. `getSpecialRatePrice` already takes priority over bike types (`special_rate_price / 2 * qty * legs`). Count how many jobs used a special rate and pass that to `UnitEconomicsCard` for the note.
