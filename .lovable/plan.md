
# Fix: "Collection Info" Button Greyed Out for Part Exchange Orders

## Problem Identified

The "Collection Info" tab button remains disabled even after filling in all Part Exchange details because the `partExchangeBikeType` field is **not included in the watch list** that triggers the `isDetailsValid` recalculation.

### Root Cause

In `CreateOrder.tsx`, the `detailsFields` watch array is missing `partExchangeBikeType`:

```typescript
// Current code (line 191-201)
const detailsFields = form.watch([
  "bikeQuantity",
  "bikes",
  "isEbayOrder",
  "collectionCode",
  "needsPaymentOnCollection",
  "paymentCollectionPhone",
  "isBikeSwap",
  "partExchangeBikeBrand",
  "partExchangeBikeModel"
  // ❌ Missing: "partExchangeBikeType"
]);
```

The validation logic in `isDetailsValid` correctly checks `partExchangeBikeType`:

```typescript
const swapValid = !isBikeSwap || (
  partExchangeBikeBrand && partExchangeBikeBrand.trim() !== '' &&
  partExchangeBikeModel && partExchangeBikeModel.trim() !== '' &&
  partExchangeBikeType && partExchangeBikeType.trim() !== ''  // ✅ Checks correctly
);
```

**However**, since `partExchangeBikeType` is not in the watch list, the `useMemo` that depends on `detailsFields` doesn't re-run when you select a bike type.

### Flow Diagram
```text
User enables Part Exchange
         ↓
Fills Brand ✅ → detailsFields updates → isDetailsValid recalculates
         ↓
Fills Model ✅ → detailsFields updates → isDetailsValid recalculates
         ↓
Selects Bike Type ✅ → detailsFields NOT updated → isDetailsValid NOT recalculated
         ↓
Button stays disabled ❌
```

## Solution

Add `partExchangeBikeType` to the `detailsFields` watch array.

### File to Modify

| File | Change |
|------|--------|
| `src/pages/CreateOrder.tsx` | Add `"partExchangeBikeType"` to the `detailsFields` watch array |

### Code Change

**Before (lines 191-201):**
```typescript
const detailsFields = form.watch([
  "bikeQuantity",
  "bikes",
  "isEbayOrder",
  "collectionCode",
  "needsPaymentOnCollection",
  "paymentCollectionPhone",
  "isBikeSwap",
  "partExchangeBikeBrand",
  "partExchangeBikeModel"
]);
```

**After:**
```typescript
const detailsFields = form.watch([
  "bikeQuantity",
  "bikes",
  "isEbayOrder",
  "collectionCode",
  "needsPaymentOnCollection",
  "paymentCollectionPhone",
  "isBikeSwap",
  "partExchangeBikeBrand",
  "partExchangeBikeModel",
  "partExchangeBikeType"  // ← Add this
]);
```

## Testing

After fix:
1. Go to Create Order page
2. Fill in bike details (brand, model, type)
3. Enable "Part Exchange" toggle
4. Fill in Part Exchange Brand
5. Fill in Part Exchange Model
6. Select Part Exchange Bike Type from dropdown
7. Verify the "Collection Info" tab button becomes enabled immediately
