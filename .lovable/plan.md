

## Add Legacy Bike Type Mapping for "Electric Bikes"

This is a small update to handle legacy orders that have "Electric Bikes" as the bike type.

---

## Summary

Legacy orders may have "Electric Bikes" stored as the bike type, but QuickBooks expects the product name format: `Collection and Delivery within England and Wales - Electric Bike - Under 25kg`

We'll add a mapping function that normalizes legacy bike type names before looking up the product.

---

## Change Required

**File:** `supabase/functions/create-quickbooks-invoice/index.ts`

Add a bike type normalization function that maps legacy names to current QuickBooks product names:

```typescript
// Map legacy bike types to current QuickBooks product names
function normalizeBikeType(bikeType: string): string {
  const legacyMappings: Record<string, string> = {
    'Electric Bikes': 'Electric Bike - Under 25kg',
    // Add other legacy mappings here if needed
  };
  
  return legacyMappings[bikeType] || bikeType;
}
```

Then update the `findProductByBikeType` call to use the normalized type:

```typescript
// In the line item creation loop
const normalizedType = normalizeBikeType(bike.type);
const product = normalizedType && normalizedType !== 'Unknown' 
  ? await findProductByBikeType(tokenData.access_token, tokenData.company_id, normalizedType)
  : null;
```

---

## Mapping Table

| Legacy Bike Type | Maps To |
|-----------------|---------|
| Electric Bikes | Electric Bike - Under 25kg |

---

## What This Fixes

- Legacy orders with `bike_type = "Electric Bikes"` will now correctly map to the QuickBooks product `Collection and Delivery within England and Wales - Electric Bike - Under 25kg`
- The mapping is extensible - you can easily add more legacy type mappings in the future if needed

