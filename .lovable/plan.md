

## Dynamic Revenue by Bike Type (Halved per Stop)

**Goal**: Replace the flat "Revenue per Job" with dynamic pricing based on bike type, using half the delivery price per stop (since each order has a collection stop and a delivery stop).

### Pricing (halved per stop)

```text
Bike Type                        Full Price   Per Stop (÷2)
────────────────────────────────────────────────────────────
Boxed Kids Bikes                    £35         £17.50
Wheelset/Frameset                   £35         £17.50
Kids Bikes                          £40         £20.00
BMX Bikes                           £40         £20.00
Turbo Trainer                       £40         £20.00
Folding Bikes                       £40         £20.00
Non-Electric (all subtypes)         £60         £30.00
Electric Bike - Under 25kg          £70         £35.00
Stationary Bikes                    £70         £35.00
Tandem Bikes                       £110         £55.00
Electric Bike - Over 25kg          £130         £65.00
Longtail Cargo Bike                £130         £65.00
Electric Bike - Over 50kg          £130         £65.00
Electric Bikes (generic)            £70         £35.00
Multiple types (fallback)           £60         £30.00
```

### Files to Create

**`src/constants/bikePricing.ts`**
- Export the `pricingData` array (same data currently in `PricingPage.tsx`)
- Export a `getRevenuePerStopForBikeType(bikeType: string): number` function that maps a bike type string to half the delivery price
- Handle all known `bike_type` values from the database, including subtypes like "Non-Electric - Road Bike" mapping to the "Non-Electric Bikes" category
- Default fallback: £30 per stop (half of £60)

### Files to Modify

**`src/pages/PricingPage.tsx`**
- Import `pricingData` from the new shared constant instead of defining it inline

**`src/services/profitabilityService.ts`**
- Add `getRevenueForTimeslip(timeslip: Timeslip): Promise<number>` that:
  - Fetches orders for the timeslip using the existing driver-name+date matching logic
  - For each order, looks up bike type in the pricing map and multiplies by `bike_quantity`
  - For orders with the `bikes` JSONB array, iterates each bike entry for its type
  - Returns total revenue (already halved per stop via the pricing constant)
- Modify `calculateProfitability` to accept an optional pre-calculated revenue amount (when in bike-type mode) instead of always using `totalJobs * revenuePerStop`
- Update `aggregateProfitability`, `calculateDailyProfitability`, `calculateWeeklyProfitabilityForMonth`, and `calculateMonthlyProfitabilityForYear` to accept a `useBikeTypePricing: boolean` flag and call `getRevenueForTimeslip` when enabled

**`src/pages/RouteProfitabilityPage.tsx`**
- Add a toggle switch in the Settings card: "Use bike-type pricing" (default off for backward compatibility)
- When enabled, hide the "Revenue per Job" input
- Pass the toggle state through to all profitability query functions
- Update `TimeslipRow` to use bike-type revenue when the toggle is on

