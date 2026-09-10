# Let the buyer pick delivery dates once the bike is collected

Today the automatic "we need your delivery dates" email only goes out after the seller has confirmed their collection dates. If we collected the bike another way — a booked route, a phone call, an ad-hoc pickup — and the seller never chose dates, the buyer is never asked, so the order sits waiting.

## What changes

1. The buyer is asked for delivery dates when either the seller has confirmed collection dates **or** the bike has already been collected. Everything else about that email stays the same: we still hold off while the bike is in inspection or repair, and we still don't ask once delivery dates are in or the bike is delivered.
2. We stop chasing the seller for collection dates once the bike has been collected — that request is pointless at that stage and currently still goes out.

## Also from yesterday

You asked what a customer sees if their postcode is wrong when setting availability. Two messages:

- Left blank: "Please enter the pickup postcode to confirm your identity." (or "delivery postcode" for the buyer)
- Wrong postcode: "That postcode doesn't match the one on this order. Please check and try again."

Both appear as a red pop-up on the availability page. Tell me if you'd like different wording.

## Still outstanding

Scheduled announcements are still not sending. The every-minute checker is registered under a database user that isn't allowed to run it, and both fixes I tried were declined: granting that user permission, and registering a fresh checker alongside it. It needs one of those two, or the job removed and recreated from the Supabase dashboard. Let me know which you prefer.

## Technical detail

In `supabase/functions/send-order-updates/index.ts`:
- the `awaiting_receiver_dates` block changes `order.sender_confirmed_at` to `(order.sender_confirmed_at || order.order_collected)`
- the `awaiting_sender_dates` / `booked_awaiting_request` block gains `&& !order.order_collected`

Then redeploy the function and run a single-order check against a collected order with no seller dates to confirm the buyer request is produced.
