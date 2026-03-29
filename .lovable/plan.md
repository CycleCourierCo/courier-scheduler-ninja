

## Map Shopify "Bike Value" property to order

### Problem
The Shopify webhook extracts `Bike Brand` and `Bike Model` from line item properties but doesn't extract the new `Bike Value` field.

### Fix

**`supabase/functions/shopify-webhook/index.ts`** — two small changes:

1. **Line ~186**: Extract the bike value from properties:
```typescript
const bikeValue = getPropertyValue(properties, 'Bike Value');
```

2. **Line ~347-351**: Add `value` to the bikes array sent to the Orders API:
```typescript
bikes: [
  {
    brand: bikeBrand,
    model: bikeModel,
    value: bikeValue || undefined
  }
],
```

The Orders API already supports the `value` field in the `bikes` array, so no other changes are needed.

