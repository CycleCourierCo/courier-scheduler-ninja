## Goal
Make Northern Ireland orders created through the public API (and Shopify, which posts to the same endpoint) behave exactly like NI orders created in the web UI — detected automatically from the receiver address, with nothing extra required from the caller.

## Current gap (verified)
- `supabase/functions/orders/index.ts` — the POST insert payload (~lines 276-306) contains no `is_northern_ireland` and no `foam_status`, and the function never imports `_shared/northernIreland.ts`.
- `src/services/orderService.ts:400,454-457` — the web UI does set `is_northern_ireland` plus `foam_status: 'pending_collection'` and `foam_pending_collection_at` at creation.
- `supabase/functions/shopify-webhook/index.ts:368` creates orders by calling the same `orders` API function, so it inherits the gap.
- Fallbacks that already work without the flag: `create-shipday-order/index.ts:160-171` (ferry routing) and `create-quickbooks-invoice/index.ts:580-582` (£120 surcharge) both re-detect NI from the receiver address.
- Fallbacks that do NOT exist: `shipday-webhook/index.ts:133` and `reconcile-shipday-orders/index.ts:257` read `is_northern_ireland` directly, so an API-created NI order would be marked plain "delivered" instead of "delivered to ferry", and the Foam My Bike board (`FoamMyBikeSection.tsx:108` filters `is_northern_ireland = true`) would never show it.

## Changes

1. **`supabase/functions/orders/index.ts`** — import `isNorthernIrelandAddress` from `../_shared/northernIreland.ts` and run it against the receiver address/region on every create. Add to the insert payload:
   - `is_northern_ireland`
   - `foam_status: 'pending_collection'` and `foam_pending_collection_at` when NI, otherwise null

   Detection is fully automatic from the receiver address — no new request field, nothing for API or Shopify callers to send. Same logic as the web UI so both paths produce identical rows.

2. **`supabase/functions/shipday-webhook/index.ts`** — add the same receiver-address fallback the other functions use, so a completed delivery leg is treated as the ferry leg when either the flag is true or the address resolves to NI. Same for `reconcile-shipday-orders/index.ts`.

3. **Backfill** — one-off data update setting `is_northern_ireland` and initialising `foam_status` for existing non-cancelled, non-delivered orders whose receiver postcode is NI but whose flag is false/null, so anything already booked via API/Shopify lands on the Foam board.

## Notes
- Detection uses the existing shared helper (BT-postcode / region match), so behaviour matches the web UI exactly.
- No changes to pricing or Shipday routing behaviour; those already handle NI correctly via fallback.
