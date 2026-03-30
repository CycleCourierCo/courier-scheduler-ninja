

## Fix: `bikeType` and `bikeValue` scoping error in Shopify webhook

### Problem
The edge function logs show: `ReferenceError: bikeType is not defined`

`bikeType` (line 186) and `bikeValue` (line 187) are declared with `const` inside the `if (shopifyOrder.line_items)` block, but the `bikes` array referencing them (lines 353-354) is outside that block scope. JavaScript `const` is block-scoped, so these variables don't exist when the payload is constructed.

### Fix

**`supabase/functions/shopify-webhook/index.ts`** — Move declarations to the outer scope alongside `bikeBrand`, `bikeModel`, `bikeQuantity`:

1. **Line ~170**: Add `bikeType` and `bikeValue` to the existing variable declarations:
```typescript
let bikeBrand = '';
let bikeModel = '';
let bikeType = '';
let bikeValue = '';
let sender: any;
let receiver: any;
let bikeQuantity = 1;
```

2. **Lines 186-187**: Change from `const` to assignment:
```typescript
bikeType = firstItem.variant_title || '';
bikeValue = getPropertyValue(properties, 'Bike Value');
```

This is a two-line fix that resolves the `ReferenceError` by ensuring `bikeType` and `bikeValue` are in scope when the Orders API payload is built. The function will auto-deploy after the change.

