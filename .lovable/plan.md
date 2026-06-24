## Findings — receiver availability email delivery

Today (Jun 24), 20 senders confirmed availability on non‑inspection orders, but only **9 `receiver_availability` emails** were sent — **11 orders never triggered the receiver email**. No edge function errors, no Resend `failed/bounced` events. The send is never invoked.

### Root cause

`src/services/availabilityService.ts → updateSenderAvailability` triggers the receiver email **client‑side** after the sender submits:

```ts
await resendReceiverAvailabilityEmail(orderId)
```

If the sender closes the tab / loses network right after submit (common on mobile), the supabase function invoke never fires. No logs because the call never starts.

### Plan

1. **Move receiver‑email triggering server‑side.**
   - Update `set_order_availability` SQL function: when `p_side='sender'` and `needs_inspection=false`, after updating the row, `pg_net.http_post` to the `send-email` edge function with `emailType: "receiver_availability"` (same anon key pattern as existing `invoke_*` functions in this DB).
   - Keep client‑side `resendReceiverAvailabilityEmail` as best‑effort fallback. If duplicates become an issue, the edge function can dedupe by checking `email_delivery_events`.

2. **Surface availability links on Order Detail** (frontend only):
   - In `src/pages/OrderDetail.tsx`, add a small "Copy link" button in the Sender Availability block (~line 1376) for `${origin}/sender-availability/${id}`.
   - Same in the Receiver Availability block for `${origin}/receiver-availability/${id}`.
   - `navigator.clipboard.writeText` + toast "Link copied". Gated to admin / route_planner (matches resend button gating).

### Out of scope

- Backfilling today's missed emails.
- Reworking `send-email`, dates‑confirmed emails, or `EmailDeliveryStatus` badge.
- Any RLS/schema changes beyond the SQL function update.
