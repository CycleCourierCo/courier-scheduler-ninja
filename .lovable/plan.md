# Availability confirmation rejected with "postcode incorrect" (CCC754175211460DARSW9)

## What the checks show so far

- The order's stored collection postcode is `BD6 3RG`, and the server normalises both sides to `bd63rg`, so `Bd6 3rg` should match.
- Calling the availability endpoint directly as an anonymous visitor with a deliberately wrong postcode returns the expected "Postcode does not match", so the server path itself is working.
- Failed attempts roll back, so there is no stored record of what the customer actually submitted.

Conclusion: the exact reason this customer was blocked is **not yet confirmed**. The frontend currently shows "That postcode doesn't match the one on this order" for *any* server error whose text happens to contain the word "postcode" — including unrelated failures (permission errors on the attempts table, missing-function/schema errors, rate limiting). So the message the customer saw may not reflect the real problem. Step 1 is to make the real error visible.

## Plan

1. Stop guessing the error
   - Surface the actual server error on the availability pages instead of pattern-matching on the word "postcode": show a specific message for a genuine postcode mismatch (matched on the error code, not the text), a separate one for rate limiting, and a generic "couldn't save your dates" message plus the raw reason in the console for anything else.
   - Log the failure (order id, side, error code/message — no personal data) so the next occurrence is diagnosable.

2. Make the postcode check harder to fail by accident
   - Compare only letters and digits (strip spaces, punctuation, case) on both sides.
   - Also accept the postcode held on the *order-level* address fields and, for a sender link, a match against the collection address in any of the stored shapes — same tolerant comparison.
   - Treat an empty/whitespace submission as "please enter your postcode" rather than "doesn't match".

3. Unblock this order
   - After the fix, confirm the sender availability for CCC754175211460DARSW9 works end to end, using the customer's dates if they resend them, or confirm it internally from the order page.

## Technical notes

- Frontend: `src/services/availabilityService.ts` (`updateSenderAvailability` / `updateReceiverAvailability`) — replace the `message.includes("postcode")` branches with checks on the Postgres error code (`23514` for the raised check violations) plus distinct handling for rate limiting; pass the real message through to the console. `src/hooks/useAvailability.tsx` keeps the empty-postcode guard.
- Database: new migration replacing `public.set_order_availability` so `_normalise_postcode` (or an inline expression) strips all non-alphanumerics rather than only whitespace, and the sender/receiver postcode lookup falls back to every stored shape already listed plus the top-level order address. Distinct error codes/messages for "postcode missing" vs "postcode mismatch" vs "rate limited".
- No change to statuses, emails, or the coordinate backfill behaviour.
