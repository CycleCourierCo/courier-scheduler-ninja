

## Add Legacy Mapping for Non-Electric Bikes

Add a mapping in the `normalizeBikeType` function so legacy orders with "Non-Electric Bikes" are mapped to the QuickBooks product "Collection and Delivery within England and Wales - Non-Electric Bikes".

---

## Change Required

**File:** `supabase/functions/create-quickbooks-invoice/index.ts`

Update the `legacyMappings` object in the `normalizeBikeType` function (lines 43-49):

**Before:**
```typescript
function normalizeBikeType(bikeType: string): string {
  const legacyMappings: Record<string, string> = {
    'Electric Bikes': 'Electric Bike - Under 25kg',
    // Add other legacy mappings here if needed
  };
  
  return legacyMappings[bikeType] || bikeType;
}
```

**After:**
```typescript
function normalizeBikeType(bikeType: string): string {
  const legacyMappings: Record<string, string> = {
    'Electric Bikes': 'Electric Bike - Under 25kg',
    'Non-Electric Bikes': 'Non-Electric Bikes',
  };
  
  return legacyMappings[bikeType] || bikeType;
}
```

---

## Result

| Legacy Bike Type | QuickBooks Product Suffix |
|------------------|---------------------------|
| Electric Bikes | Electric Bike - Under 25kg |
| Non-Electric Bikes | Non-Electric Bikes |

This ensures legacy orders with "Non-Electric Bikes" are matched to:
**Collection and Delivery within England and Wales - Non-Electric Bikes**

