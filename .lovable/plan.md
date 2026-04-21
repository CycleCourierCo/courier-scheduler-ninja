

## Fix: BST adjustment missing in WhatsApp/SendZen Shipday updates

### Root cause
The original BST fix was added to `create-shipday-order` (initial Shipday job creation) but **not** to the two functions that **update** the Shipday job when an admin sends a timeslot:
- `supabase/functions/send-timeslot-whatsapp/index.ts` (lines ~313, 391–405)
- `supabase/functions/send-sendzen-whatsapp/index.ts` (lines ~145, 232–236)

Both call `PUT https://api.shipday.com/order/edit/{shipdayId}` with `expectedPickupTime` / `expectedDeliveryTime` taken straight from the timeslot (e.g. `13:50:00`). Shipday treats those as UTC and adds the company's BST offset → portal shows `14:50`.

For order `CCC754236186579DANW11` the DB has `pickup_timeslot = 13:50:00`. The site renders `13:50–16:50` correctly. The most recent Shipday update came from one of these two functions (when the timeslot was sent), pushing `13:50/16:50` → Shipday displays `14:50/17:50`. This matches what the user sees.

### Fix
Reuse the same BST helpers from `create-shipday-order`:
```ts
isDateInBST(dateStr: string): boolean
adjustTimeForShipday(timeStr, dateStr): string  // subtracts 1h when in BST
```

Apply them in both update functions just before building `requestBody`:
```ts
const adjustedStart = adjustTimeForShipday(expectedPickupTime,  expectedDeliveryDate);
const adjustedEnd   = adjustTimeForShipday(expectedDeliveryTime, expectedDeliveryDate);
```
Then send `adjustedStart` / `adjustedEnd` as `expectedPickupTime` / `expectedDeliveryTime`.

`expectedDeliveryDate` is already the right date string (handles end-of-day rollover), so it's the correct date to test BST against.

### Files changed
1. `supabase/functions/send-timeslot-whatsapp/index.ts` — add BST helpers (top of file) and adjust times before the `PUT /order/edit/{id}` call.
2. `supabase/functions/send-sendzen-whatsapp/index.ts` — same change.

No DB changes. No frontend changes. `create-shipday-order` already correct from the previous fix.

### Verification
- After redeploy, re-trigger the timeslot send for `CCC754236186579DANW11` (or any current BST-dated order with timeslot `13:50`).
- Check edge function logs — payload should now show `expectedPickupTime: "12:50:00"`, `expectedDeliveryTime: "15:50:00"`.
- Shipday portal should display `13:50 – 16:50`, matching the website.
- For a winter (GMT) date, no adjustment is applied — times pass through unchanged.

