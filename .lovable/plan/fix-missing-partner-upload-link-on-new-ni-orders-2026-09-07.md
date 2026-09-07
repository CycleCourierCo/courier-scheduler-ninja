# Fix missing partner upload link on new NI orders

Order CCC754449644132IANBT8 was notified at the moment the order was created. The email built on that path never receives the order's own reference, so the "Upload label and BFS number" button is dropped — the shared email builder only adds the button when it knows which order the link should point at. Resending from the order page does pass it, which is why manual resends include the button.

## Change

- Pass the order reference when the partner email is sent during order creation, so every new Northern Ireland order gets the upload button.
- For this order (and any earlier NI orders emailed without the button), resend the partner email from the order page's Northern Ireland section so City Air Express receives a working link.

## Technical notes

- `supabase/functions/orders/index.ts`: add `orderId: order.id` to the `buildFerryPartnerEmail({ ... })` call in the Northern Ireland background block; redeploy the `orders` function.
- No change needed to `_shared/ferryPartnerEmail.ts` or `send-ferry-partner-notification` (that one already sends `orderId`).
