

## Fix: Wrong Property Paths in Both Edge Functions

### Root Cause (Shared)

Both `build-postcode-patterns` and `predict-routes` read the wrong property paths from the `sender`/`receiver` JSONB columns. The actual order data structure is:

```json
{
  "sender": {
    "name": "...",
    "address": {
      "street": "...",
      "city": "...",
      "zipCode": "DE65 5SN",
      "lat": 52.9,
      "lon": -1.7
    }
  }
}
```

But both functions look for `sender.postcode`, `sender.lat`, etc. at the top level.

### Changes

**1. `supabase/functions/build-postcode-patterns/index.ts`**

- Line 73: Change `order.sender?.postcode || order.sender?.postal_code` → `order.sender?.address?.zipCode || order.sender?.address?.postal_code || order.sender?.postcode`
- Line 74: Same pattern for receiver
- Add debug logging after the loop to show how many postcodes were extracted vs skipped

**2. `supabase/functions/predict-routes/index.ts`**

- Lines 103-106: Change `sender?.lat` → `sender?.address?.lat || sender?.lat` (and same for lon, receiver)
- Lines 111-112: Change `sender?.postcode || sender?.postal_code` → `sender?.address?.zipCode || sender?.address?.postal_code || sender?.postcode` (and same for receiver)
- Check `formatAddress` helper for the same nested path issue and fix accordingly
- Add logging after the stop expansion loop showing created vs skipped count

Both fixes add fallback chains so they work with both the nested `address` structure and any legacy flat structure.

