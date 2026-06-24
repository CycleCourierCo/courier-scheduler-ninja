## Two issues

### 1. Why it still shows "Sent" only

The `resend-webhook` edge function is receiving the events from Resend, but **every signature verification is failing** (logs show repeated `Signature verification failed` at the exact times you clicked the email). Only the original `sent` row from when we dispatched the email is in `email_delivery_events` — no `delivered` / `opened` / `clicked` rows have been inserted, because we reject them before insert.

That means the value stored in `RESEND_WEBHOOK_SECRET` is not the actual signing secret of this webhook endpoint. In Resend → Webhooks → click the endpoint → copy the **Signing Secret** (starts with `whsec_…`). Then update the secret — once correct, future opens/clicks will flow through automatically and the existing badge will start updating.

### 2. Move the status badge to the availability section

Currently the `EmailDeliveryStatus` badge renders next to the email address inside the Sender/Receiver Information card. I'll move it to the "Sender Availability" / "Receiver Availability" headers in `OrderDetail.tsx` (around lines 1370 and 1419) instead.

**Files to change:**
- `src/components/order-detail/ContactDetails.tsx` — remove the badge import and the wrapper next to the email.
- `src/components/order-detail/AdminContactEditor.tsx` — same removal.
- `src/pages/OrderDetail.tsx` — render `<EmailDeliveryStatus orderId={id} side="sender" />` next to the "Sender Availability" h3, and the receiver equivalent next to the "Receiver Availability" h3.

No DB, edge function or business-logic changes — purely a UI relocation.

Switch to build mode (or approve) and I'll apply the move, and please update `RESEND_WEBHOOK_SECRET` to the correct `whsec_…` value when you can.