# Let the buyer pick delivery dates once the bike is collected

Confirmed on CCC754783937262GARCR0: the bike is collected, but the seller never chose collection dates, so the buyer's availability page shows "Awaiting sender dates" and no delivery dates can be given.

## What changes

1. The buyer's availability page allows dates when the seller has given collection dates **or** the bike has already been collected. The inspection/repair hold stays exactly as it is.
2. The automatic "we need your delivery dates" email uses the same rule, so collected orders with no seller dates get chased properly.
3. We stop chasing the seller for collection dates once the bike has been collected — that request currently still goes out and is pointless.

## Postcode question from yesterday

- Left blank: "Please enter the pickup postcode to confirm your identity." (or "delivery postcode" for the buyer)
- Doesn't match the order: "That postcode doesn't match the one on this order. Please check and try again."

Both show as a red pop-up. Say the word if you want different wording.

## Still outstanding

Scheduled announcements are still not sending: their every-minute checker is registered under a database user that isn't allowed to run it. Both fixes I offered were declined (granting that user permission, or registering a fresh checker). It needs one of those, or the job recreated from the Supabase dashboard.

## Technical detail

- `src/pages/ReceiverAvailability.tsx`: the `senderDatesSet` guard becomes `senderDatesSet || order?.orderCollected` (confirm the collected flag is exposed on the public order payload; add it to `_build_public_order_payload` / `orderServiceUtils` if not).
- `supabase/functions/send-order-updates/index.ts`: `awaiting_receiver_dates` gate becomes `(order.sender_confirmed_at || order.order_collected)`; `awaiting_sender_dates` gains `&& !order.order_collected`. Redeploy and verify with a single-order run against this order.
