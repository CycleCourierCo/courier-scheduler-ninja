

## Fix: Bulk upload orders missing lat/lon coordinates

### Problem
The bulk upload flow calls `createOrder()` in `orderService.ts`, which inserts directly into the `orders` table via the Supabase client. This path does **not** go through the `orders` edge function, which is where geocoding happens. As a result:

- **Receiver address**: Never gets lat/lon because `groupedOrderToFormData` builds the address without coordinates and there's no geocoding step
- **Sender address**: Only gets lat/lon if the user's profile has `latitude`/`longitude` set (most profiles likely don't)

### Solution
Add geocoding to the `createOrder` function in `orderService.ts` so that **all** order creation paths (single order, bulk upload) automatically geocode addresses when lat/lon are missing.

### Changes

**`src/services/orderService.ts`** — Add geocoding before insert

1. Import `geocodeAddress` and `buildAddressString` from `@/utils/geocoding`
2. After extracting sender/receiver address fields (line ~259-271), check if lat/lon are missing for either address
3. If missing, call `geocodeAddress()` with the full address string to fetch coordinates
4. Use the returned coordinates in the insert payload

```text
Flow:
  Extract address fields
  → If senderLat/senderLon missing → geocodeAddress(senderAddressString)
  → If receiverLat/receiverLon missing → geocodeAddress(receiverAddressString)
  → Insert order with coordinates
```

This is a small change (~15 lines) that fixes both single-order creation (when address is entered manually without autocomplete) and bulk uploads. The existing `