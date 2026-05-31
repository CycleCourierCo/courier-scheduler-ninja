## Goals

1. When a Shipday **delivery leg fails** (`ORDER_FAILED` on the delivery job) on an already-collected order, do **not** trigger the "Bike Collected" emails (to sender + receiver) nor the auto "Please confirm your delivery availability" email.
2. When an order **needs inspection**, do **not** email the receiver to choose delivery dates as soon as the sender confirms theirs. Only trigger that receiver-availability email **after** the inspection reaches `repaired` (i.e. all approved issues repaired, or every issue declined — both already resolve to `status='repaired'`).

## Changes

### 1. `supabase/functions/shipday-webhook/index.ts`

Today on a failed delivery for a collected bike, `computeRevert(true)` sets `newStatus = 'collected'`. The block at lines 363–435 then fires "collection confirmation" emails and (inside `send-email`) the receiver-availability email.

- Gate the `newStatus === "collected"` email block (line 364) with an additional condition: only invoke `send-email` when `event === "ORDER_COMPLETED"` or `event === "ORDER_POD_UPLOAD"` (the two paths that legitimately move the order to `collected`). Skip entirely for `ORDER_FAILED`.
- Leave status revert + Shipday job re-creation untouched — only the email side effect is suppressed.

### 2. `src/services/availabilityService.ts`

In `updateSenderAvailability` and `confirmSenderAvailability`:

- After updating the order with `pickup_date`, fetch `needs_inspection` (already loaded on the returned row in `updateSenderAvailability`; add a select for `confirmSenderAvailability`).
- If `needs_inspection === true`:
  - Still send the sender-dates-confirmed email.
  - **Skip** `resendReceiverAvailabilityEmail(orderId)` and **skip** the `status → receiver_availability_pending` update. Instead leave status as `sender_availability_confirmed` (or new `awaiting_inspection_completion` — simplest is to keep `sender_availability_confirmed` to avoid a migration) so no receiver email is triggered.
- If `needs_inspection !== true`: existing behaviour (send receiver availability email immediately).

### 3. `src/services/inspectionService.ts`

When an inspection transitions to `repaired` (the reconcile loop at lines 58–70, plus any direct setters that move status to `'repaired'`):

- After the `UPDATE bicycle_inspections SET status='repaired'` succeeds, look up the order's `delivery_date` and `needs_inspection`:
  - If `needs_inspection === true` AND receiver has no `delivery_date` set yet, call `resendReceiverAvailabilityEmail(order_id)` and update the order `status` to `receiver_availability_pending`.
  - Guard with an idempotency check (e.g. only send when current order status is `sender_availability_confirmed`) to avoid duplicate sends if reconcile runs repeatedly.

No DB schema changes required. No edge-function-only behaviour beyond the webhook tweak (which will be redeployed).

## Out of scope

- No UI changes.
- No changes to the "delivery confirmation" email flow.
- No changes to inspection workflow itself — only the email trigger timing.
