## Two parts

### 1. Email clicked tracking (answer)

Yes — the webhook already handles `email.clicked` events (also `delivered`, `opened`, `bounced`, `complained`, `delivery_delayed`). `EmailDeliveryStatus` already renders a "Clicked" badge with an indigo MousePointerClick icon when Resend reports a click. Make sure the `email.clicked` event is enabled in the Resend webhook configuration (Resend dashboard → Webhooks → endpoint → Events to send) — currently you may only have `email.delivered` / `email.opened` enabled.

### 2. Show email status in Timeslot section

Currently the timeslot email sent from `send-timeslot-whatsapp` is **not tagged**, so the webhook can't link delivery events back to the order. Two changes needed:

**a. Tag the timeslot email** (`supabase/functions/send-timeslot-whatsapp/index.ts`, around line 598)
Add `tags` to the `resend.emails.send(...)` call:
```
tags: [
  { name: 'email_type', value: 'timeslot' },
  { name: 'side', value: recipientType },   // 'sender' | 'receiver'
  { name: 'order_id', value: String(orderId) },
]
```
Also insert an immediate `sent` row into `email_delivery_events` with `email_type: 'timeslot'` (same pattern used in `send-email/index.ts` lines 375–401) so the badge appears instantly.

**b. Make `EmailDeliveryStatus` filterable by `email_type`** (`src/components/order-detail/EmailDeliveryStatus.tsx`)
Add an optional `emailType?: string` prop. When provided, add `.eq("email_type", emailType)` to the query and filter the realtime INSERT handler the same way. Existing usages (availability) keep working unchanged because the prop is optional — but to keep availability and timeslot badges distinct, pass `emailType="sender_availability"` / `"receiver_availability"` from `ContactDetails.tsx` and `emailType="timeslot"` from the new placement.

**c. Render badge in `TimeslotSelection`** (`src/components/order-detail/TimeslotSelection.tsx`)
In the `CardHeader`, next to the title, render:
```
<EmailDeliveryStatus orderId={orderId} side={type} emailType="timeslot" />
```
so each timeslot card (collection / delivery) shows its own email lifecycle (Sent → Delivered → Opened → Clicked).

### Files touched
- `supabase/functions/send-timeslot-whatsapp/index.ts` — add tags + log `sent` event
- `src/components/order-detail/EmailDeliveryStatus.tsx` — add optional `emailType` filter
- `src/components/order-detail/TimeslotSelection.tsx` — render the badge
- `src/components/order-detail/ContactDetails.tsx` — pass `emailType="{side}_availability"` to existing usages so timeslot vs. availability stay separate

### Out of scope
No DB schema change required — `email_delivery_events.email_type` already exists.
