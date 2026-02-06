
# Update Bike Type Options

## Overview

Update the bike type dropdown options to include new categories and more specific classifications for electric and non-electric bikes.

---

## Current Bike Types

| Current Option |
|----------------|
| Non-Electric Bikes |
| Electric Bikes |
| Stationary Bikes |
| Kids Bikes |
| BMX Bikes |
| Boxed Kids Bikes |
| Folding Bikes |
| Tandem Bikes |
| Travel Bike Boxes |

---

## New Bike Types

| New Option | Notes |
|------------|-------|
| Non-Electric - Mountain Bike | Replaces "Non-Electric Bikes" |
| Non-Electric - Road Bike | Replaces "Non-Electric Bikes" |
| Electric Bike - Under 25kg | Replaces "Electric Bikes" |
| Electric Bike - 25-50kg | Replaces "Electric Bikes" |
| Hybrid Bike | New option |
| Cargo Bike | New option |
| Longtail Cargo Bike | New option |
| Stationary Bikes | Unchanged |
| Kids Bikes | Unchanged |
| BMX Bikes | Unchanged |
| Boxed Kids Bikes | Unchanged |
| Folding Bikes | Unchanged |
| Tandem Bikes | Unchanged |
| Travel Bike Boxes | Unchanged |
| Bike Wheels | New option |

---

## File to Modify

| File | Changes |
|------|---------|
| `src/components/create-order/OrderDetails.tsx` | Update the `BIKE_TYPES` constant |

---

## Implementation Details

Update the `BIKE_TYPES` array in `src/components/create-order/OrderDetails.tsx`:

```typescript
const BIKE_TYPES = [
  "Non-Electric - Mountain Bike",
  "Non-Electric - Road Bike",
  "Electric Bike - Under 25kg",
  "Electric Bike - 25-50kg",
  "Hybrid Bike",
  "Cargo Bike",
  "Longtail Cargo Bike",
  "Stationary Bikes",
  "Kids Bikes",
  "BMX Bikes",
  "Boxed Kids Bikes",
  "Folding Bikes",
  "Tandem Bikes",
  "Travel Bike Boxes",
  "Bike Wheels",
] as const;
```

---

## Impact Analysis

| Area | Impact |
|------|--------|
| Create Order Form | New dropdown options available |
| Order Labels | Bike type displayed as-is (no changes needed) |
| OptimoRoute Sync | Bike type included in notes (no changes needed) |
| Existing Orders | Unaffected - existing orders keep their original bike type value |
| Database | No schema changes required - bike_type is a text field |

---

## Summary

| Task | Description |
|------|-------------|
| Update BIKE_TYPES constant | Replace old options with new specific bike type categories |
| No migration needed | Existing orders retain their original bike type values |
| No other file changes | The bike type is stored and displayed as a string throughout the system |
