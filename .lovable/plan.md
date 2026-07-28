## Goal

When a Northern Ireland order is marked **Delivered to ferry** (Shipday delivery to City Air Express completed), automatically email the receiver telling them their bike has reached the ferry port and is awaiting transport across the Irish Sea.

## What the customer gets

- Subject: "Your Bicycle Has Reached the Ferry Port - The Cycle Courier Co."
- Body: greeting by name, bike details + tracking number, explanation that the bike is at the port and is awaiting the crossing, a "Track Your Bicycle" button to the tracking page, and a note that they'll be contacted for final delivery.
- Sent to the receiver only (the real Northern Ireland customer), not City Air Express, and no review-request block (that stays on final delivery).

## Technical changes

1. **Database migration**
  - Add `ferry_confirmation_sent_at timestamptz` to `public.orders` so the email is sent once only (same pattern as `delivery_confirmation_sent_at`).
2. `**supabase/functions/send-email/index.ts**`
  - Handle new action `meta.action === "ferry_confirmation"` → `handleFerryConfirmation(orderId, resend)`.
  - The handler: loads the order, exits early if `ferry_confirmation_sent_at` is set, builds the HTML above, sends via Resend from `Ccc@notification.cyclecourierco.com` with `reply_to: Info@cyclecourierco.com`, then stamps `ferry_confirmation_sent_at`.
  - Existing test-account skip logic already applies via `meta.orderId`.
3. `**supabase/functions/shipday-webhook/index.ts**`
  - In the block that already sets `newStatus = "delivered_to_ferry"`, after the order update, invoke `send-email` with `{ meta: { action: "ferry_confirmation", orderId } }` (only on `ORDER_COMPLETED` / `ORDER_POD_UPLOAD`, wrapped in try/catch and logged, mirroring the existing confirmation email calls).

Both edge functions redeploy automatically.