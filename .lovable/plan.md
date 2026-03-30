

## Consolidate Shopify and Portal Bike Types

### Changes

**`src/constants/bikePricing.ts`** — Add aliases and new IDs:

1. **`BIKE_TYPE_BY_ID`** — Add three new entries:
   - `18: 'Recumbent'`
   - `19: 'Trike'`
   - `20: 'Non-Electric - Gravel Bike'`

2. **`bikeTypePriceMap`** — Add Shopify name aliases:
   - `"Wheels/Frame Boxed Or Unboxed": 35`
   - `"Non-Electric - Hybrid Bike": 60`
   - `"Non-Electric - Gravel Bike": 60`
   - `"Trike": 150` (mapped to Small Trike price)

No changes needed to the Shopify webhook — it already passes bike type strings as-is, and these aliases ensure correct price resolution.

