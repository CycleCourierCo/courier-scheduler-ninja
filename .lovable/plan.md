

## Map Shopify `variant_title` as `bike_type`

### Current state
The webhook extracts `variant_title` as a fallback for `bikeModel` (line 185) but never sends a `bike_type` to the Orders API. The `variant_title` in Shopify corresponds to the bike type selection (e.g. "Non-Electric - Road Bike", "Electric Bike - Under 25kg").

### Fix

**`supabase/functions/shopify-webhook/index.ts`** — two changes:

1. **Line ~185**: Extract `variant_title` as `bikeType` instead of using it as model fallback:
```typescript
bikeBrand = getPropertyValue(properties, 'Bike Brand') || firstItem.title || 'Unknown';
bikeModel = getPropertyValue(properties, 'Bike Model') || '';
const bikeType = firstItem.variant_title || '';
```

2. **Lines ~348-354**: Add `type` to the bikes array sent to the Orders API:
```typescript
bikes: [
  {
    brand: bikeBrand,
    model: bikeModel,
    type: bikeType || undefined,
    value: bikeValue || undefined
  }
],
```

The Orders API already reads `type` from individual bike objects in the `bikes` array and maps it to the `bike_type` column. No other changes needed.

