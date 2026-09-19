# Price Travel Bike Boxes at £50 + VAT, listed under Folding Bikes

Change the Travel Bike Boxes price from £60 + VAT to £50 + VAT everywhere it appears, and move it in the price list so it sits directly below Folding Bikes.

## Changes

1. **`src/constants/bikePricing.ts`**
   - In `pricingData`, change Travel Bike Boxes price from 60 to 50 and reorder the array so it appears immediately after "Folding Bikes" (currently it sits after "Non-Electric Bikes").
   - In `bikeTypePriceMap`, update both `"Travel Bike Box": 60` and `"Travel Bike Boxes": 60` to 50. This map feeds route profitability revenue, so the calculations use the new price too.

2. **`docs/API_DOCUMENTATION.md`**
   - Update the bike-type table entry for Travel Bike Box (ID 14) from £60 to £50 so partner-facing docs match.

No database, permissions, or workflow changes. Other pages (Pricing page, order creation) read from these constants, so they pick the change up automatically.

## Verification

- Build passes.
- Pricing page shows Travel Bike Boxes at £50 + VAT directly below Folding Bikes.
