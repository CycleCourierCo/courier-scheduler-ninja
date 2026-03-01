

## Dynamic Revenue by Bike Type (Halved per Stop) — IMPLEMENTED

**Status**: ✅ Complete

### What was done

1. **Created `src/constants/bikePricing.ts`** — Shared pricing data array and `getRevenuePerStopForBikeType()` function that maps order bike types to halved delivery prices
2. **Updated `src/pages/PricingPage.tsx`** — Now imports pricing data from shared constant
3. **Updated `src/services/profitabilityService.ts`** — Added `getRevenueForTimeslip()` and updated all calculation functions with `useBikeTypePricing` flag
4. **Updated `src/pages/RouteProfitabilityPage.tsx`** — Added "Use bike-type pricing" toggle in Settings card; hides flat rate input when enabled
