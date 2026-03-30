

## Change Electric Bike over 25kg price to £99

### Changes

**`src/constants/bikePricing.ts`** — Update price from £130 to £99 in three places:

1. **Line 12** — `pricingData` array: `{ type: "Electric Bikes over 25kg", price: 99 }`
2. **Lines 70-72** — `bikeTypePriceMap`: Change all three Electric Bike over 25kg/50kg entries from `130` to `99`:
   - `"Electric Bike - Over 25kg": 99`
   - `"Electric Bikes over 25kg": 99`
   - `"Electric Bike - Over 50kg": 99`

This updates the B2B pricing page display, the revenue-per-stop calculation for profitability reports, and the QuickBooks invoicing lookup. No other files need changes.

