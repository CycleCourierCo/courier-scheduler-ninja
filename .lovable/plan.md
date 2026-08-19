# Fix: business "bike is ready now" option missing on sender availability

## What's wrong

On CCC754937167108PRODL8 the sender is the Pro Bike Trader business account (order owner, `is_business = true`, opening hours Mon–Thu + Sun 09:00–21:00), yet the sender availability page shows the plain calendar instead of the "Bike is available now / Bike isn't available yet" choice.

Cause (verified): the page decides whether you are the business sender by comparing your profile email to the order's sender email, but the availability pages load the order through the public tracking function, which deliberately returns only the sender's name, city and country (and blanks `user_id`). So the email comparison never matches and the business branch is never shown — for any order, not just this one.

## The fix

1. Identify the business sender from data that actually exists, instead of the redacted public payload:
   - when someone is signed in, do a second lookup of the order restricted to the signed-in user (row-level security already limits this to their own orders) to read `user_id` and the sender contact;
   - treat them as the business sender when the order belongs to them and their profile is a business account, or when their profile email / accounts email matches the order's sender email.
2. Keep the public page working unchanged for guests and non-business senders (no extra request when nobody is signed in).
3. Once matched, show the existing two-option screen. Confirm the "Bike is available now" path fills the next 7 open days from the profile's opening hours (skipping closed days, holidays and blocked dates — for this account that means skipping Friday and Saturday) and appends the per-day collection windows to the collection notes.
4. Show the same choice on return visits until dates are actually confirmed, and add a small "Back to options" link so a business can switch between "available now" and "not available yet" without reloading.

## Technical notes

- `src/pages/SenderAvailability.tsx`: replace the `isBusinessSender` derivation with the ownership-aware check; add a lightweight authenticated fetch (id, `user_id`, sender email) guarded by `user` presence.
- Reuse `getNextOpenDays` / `describeOpeningWindows` in `src/lib/businessAvailability.ts` as-is; no schema changes.
- `src/hooks/useAvailability.tsx` and the public order function stay untouched, so tracking privacy is unchanged.
