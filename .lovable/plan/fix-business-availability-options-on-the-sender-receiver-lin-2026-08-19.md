# Fix: business availability options on the sender/receiver links

## What's wrong

On CCC754937167108PRODL8 the sender is the Pro Bike Trader business account (order owner, `is_business = true`, opening hours Mon–Thu + Sun 09:00–21:00), yet the sender availability page shows the plain calendar instead of the "Bike is available now / Bike isn't available yet" choice.

Cause (verified): the page decides whether you are the business sender by comparing your profile email to the order's sender email, but the availability pages load the order through the public tracking function, which returns only the sender's name, city and country and blanks `user_id`. The email comparison can therefore never match — and it can't work at all when the business follows the emailed link without logging in.

## The fix — decide it server-side, no login needed

Mark each side of the order as business or not, and send that (plus the collection/delivery windows) down with the public order payload. The link then renders the business options for whichever side it is for.

1. Public order data gains three safe extra fields per side: `sender_is_business` / `receiver_is_business` and the matching `opening_hours` (day + open/close times only — no emails, phones or addresses added).
   - A side counts as business when it belongs to an approved business profile: the order owner's profile for the sender side, or a profile whose email / accounts email matches that side's contact email. The matching happens inside the security-definer function so no contact details are exposed.
2. Sender availability page: show the "Bike is available now (collect within business hours)" vs "Bike isn't available yet" choice whenever `sender_is_business` is true — for signed-in users and for guests following the emailed link. "Available now" pre-fills the next 7 open days from the returned opening hours (skipping closed days, holidays and blocked dates — Friday and Saturday for this account) and appends the per-day windows to the collection notes.
3. Receiver availability page: same treatment when `receiver_is_business` is true — "Deliver any time during our business hours" (pre-fills the next 7 open days) vs "Pick specific dates". Business receivers see this instead of the neighbour / workplace alternative-address options, which stay for consumer receivers.
4. Keep the choice available on return visits until dates are confirmed, with a "Back to options" link so either side can switch paths without reloading.

## Technical notes

- Migration: extend `_build_public_order_payload` (used by `get_public_order`, `get_public_order_with_proof`) to add `sender_is_business`, `receiver_is_business`, `sender_opening_hours`, `receiver_opening_hours`, resolved via lookups against `profiles` with `is_business` / approved status. No new columns.
- `src/services/orderServiceUtils.ts`: map the new fields onto the order type.
- `src/pages/SenderAvailability.tsx`: drive the business branch off the payload flag instead of the logged-in profile email; keep `getNextOpenDays` / `describeOpeningWindows` from `src/lib/businessAvailability.ts`.
- `src/pages/ReceiverAvailability.tsx`: add the mirrored business branch, gating `AltLocationFields` to non-business receivers.
- No change to which contact details the public tracking payload reveals.
