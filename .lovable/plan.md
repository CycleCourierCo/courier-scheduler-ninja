## What I found

For order `CCC754877137960COLBT4` (receiver postcode `BT48 8JP`):

- The database row still has `is_northern_ireland = false`, `destination_region = null`, `foam_status = null` — so the "Mark as Northern Ireland delivery" write did not persist (the Supabase update is fired without checking how many rows came back, so a silent 0-row update looks like success).
- Because the flag is false, the Shipday job was created against the real NI address: the edge function log shows `customerName: "Brendan Whelan"`, `customerAddress: "67 Coney Road, Culmore, County Londonderry BT48 8JP"`.
- The "NORTHERN IRELAND DELIVERY" text in that job is just the order's own `delivery_instructions` field, not the code's hand-off note — further confirmation the NI branch never ran.
- The edge function's postcode fallback (`isNorthernIrelandAddress`) should have caught `BT48` even with the flag false, so the deployed copy of `create-shipday-order` is also suspect and needs redeploying.

## Fix

**1. Make the flag write verifiable (`src/components/order-detail/NorthernIrelandEditor.tsx`)**
- Change the update to `.update(patch).eq("id", order.id).select("id, is_northern_ireland, foam_status").maybeSingle()`.
- If no row is returned or the returned `is_northern_ireland` doesn't match what was requested, abort with a clear error and do NOT touch Shipday.
- Only after a confirmed write, re-route the delivery leg.

**2. Remove the read-after-write dependency (`supabase/functions/create-shipday-order/index.ts`)**
- Accept an optional `forceNorthernIreland: boolean` in the request body.
- Resolve `isNI` as: `forceNorthernIreland ?? (order.is_northern_ireland === true || isNorthernIrelandAddress(receiver?.address))`.
- Log the resolved `isNI`, the source of that decision, and the final delivery address so future failures are diagnosable from the logs.
- Pass `forceNorthernIreland` from the editor (and from `createShipdayOrder` in `src/services/shipdayService.ts` as an optional argument) when re-routing.

**3. Redeploy the NI-aware functions**
- Redeploy `create-shipday-order` (and `_shared/northernIreland.ts` consumers) so the live version matches the repo.

**4. Repair the affected order**
- Set `is_northern_ireland = true`, `destination_region = 'Northern Ireland'`, `foam_status = 'pending_collection'` on `CCC754877137960COLBT4`.
- Delete Shipday delivery job `50983151` and re-create the delivery leg so it lands on City Air Express, Unit 1 Ordinal Street, Trafford Park, Manchester M17 1GB, with the NI receiver block in the instructions.

**5. Post-fix check**
- Re-read the order row and the edge function log to confirm the new job's `customerName` is `City Air Express` and the address is the Manchester one, and report the result.

### Notes
Collection leg is untouched throughout. The £120-per-bike surcharge and the Foam My Bike pipeline both key off `is_northern_ireland`, so both start working correctly once the flag actually persists.
