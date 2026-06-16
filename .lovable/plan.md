## Goal

When the admin "Reconcile Shipday (24h)" button updates an order to `collected` or `delivered`, it should behave exactly like a real-time Shipday webhook would — including notifying the customer.

## What the live `shipday-webhook` does on completion (and what reconcile currently skips)

| Side effect | Webhook | Reconcile today |
|---|---|---|
| `status` update | yes | yes |
| `tracking_events.shipday.updates` append | yes | yes |
| `order_collected` / `order_delivered` flags | yes | yes |
| **Collection confirmation email** (sender + receiver) via `send-email` action `collection_confirmation` | yes | **no — suppressed** |
| **Delivery confirmation email** (sender + receiver) via `send-email` action `delivery_confirmation` | yes | **no — suppressed** |
| On `ORDER_FAILED`: clear the failed leg's `scheduled_*_date`, `*_timeslot`, `shipday_*_id` and re-invoke `create-shipday-order` for that leg | yes | partially — clears fields but does **not** re-create the Shipday job |

No WhatsApp/SMS or invoice work is triggered directly from the webhook on collection/delivery, so nothing else is missing on that path.

## Changes (single file: `supabase/functions/reconcile-shipday-orders/index.ts`)

1. **Remove the email-suppression stamping.** Drop the two blocks that pre-fill `collection_confirmation_sent_at` / `delivery_confirmation_sent_at` so the downstream send actually fires.
2. **After a successful row update, fire the same `send-email` invocations the webhook fires**, mirroring its logic exactly:
   - if `newStatus === "collected"` and event is `ORDER_COMPLETED` or `ORDER_POD_UPLOAD` and `collection_confirmation_sent_at` is still null → invoke `send-email` with `{ meta: { action: "collection_confirmation", orderId } }`.
   - if `newStatus === "delivered"` and `delivery_confirmation_sent_at` is still null → invoke `send-email` with `{ meta: { action: "delivery_confirmation", orderId } }`.
   - Wrap in try/catch; on error, push to the `errors[]` array but keep going.
3. **Mirror the `ORDER_FAILED` re-creation** — after the update, invoke `create-shipday-order` with `{ orderId, jobType: isPickup ? 'pickup' : 'delivery' }` just like the webhook does.
4. **Add a `suppressEmails` request flag (default `false`)** so the admin can opt-out for very old backfills where day-late emails would confuse customers. UI button stays as-is and sends `suppressEmails: false`; the flag is there only as an escape hatch for future invocations.
5. **Fix the original `extractStatus` / status-mapping issue** that was already planned, so rows actually transition in the first place (broaden status detection, expanded vocabulary, and one-shot diagnostic logging of a sample order per Shipday endpoint).
6. **Response payload** gains `emailsTriggered: { collection: number, delivery: number }` so the admin gets confirmation of how many notifications were sent.

## Heads-up to the user

Re-running reconcile against Lydia Fahy's order (and the other ~55 affected orders from the past 24h) will send collection and/or delivery confirmation emails to the sender and receiver for each one. That's the desired behaviour per your request, but worth flagging because some emails will arrive hours after the actual event.

No DB migrations, no UI changes beyond the existing button, no new secrets.