

## Plan: Make SendZen Shipday Logic an Exact Copy of 2Chat

### Problem
The SendZen edge function's `updateShipday` helper has subtle differences from the proven 2Chat `send-timeslot-whatsapp` Shipday logic — missing input validation, missing detailed payload logging, and slightly different error handling. Even though Shipday returns 200, the times may not be updating correctly.

### Root Cause Analysis
Comparing the two functions:
1. **Missing validation** — SendZen's `toUTCYYYYMMDD` lacks the `Number.isNaN` check; `addMinutesToHHMM` lacks input range validation
2. **No payload logging** — The 2Chat version logs every field of the Shipday request body (orderId, jobType, shipdayId, scheduledRaw, scheduledUTCDate, expectedPickupTime, expectedDeliveryTime, expectedDeliveryDate). SendZen only logs the status code, making debugging impossible
3. **Inline vs helper function** — The 2Chat version runs Shipday synchronously inline with full error tracking; the SendZen version runs it in a fire-and-forget background helper

### Changes

**`supabase/functions/send-sendzen-whatsapp/index.ts`**

Replace the `updateShipday` helper function (lines 92-176) with an exact copy of the Shipday logic from `send-timeslot-whatsapp` (lines 269-472), adapted as a helper function:

- Copy the `toUTCYYYYMMDD` function with the `Number.isNaN` validation check
- Copy the `addMinutesToHHMM` function with full input validation (range checks for h/m)
- Add the detailed `console.log("Shipday update payload:", { ... })` logging that includes: `orderId`, `jobType`, `shipdayId`, `scheduledRaw`, `scheduledUTCDate`, `expectedPickupTime`, `expectedDeliveryTime`, `expectedDeliveryDate`
- Keep the same request body structure: `orderNumber`, `customerName`, `customerAddress`, `customerEmail`, `customerPhoneNumber`, `restaurantName`, `restaurantAddress`, `expectedPickupTime`, `expectedDeliveryTime`, `expectedDeliveryDate`, `deliveryInstruction`
- Log skipped jobs explicitly (when no shipdayId or no scheduledRaw) instead of silently `continue`-ing

No client-side changes needed.

