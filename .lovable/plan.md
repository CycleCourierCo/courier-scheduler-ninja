# Fix: dealer bulk availability shows nothing for some accounts

## What's wrong

eBike Exchange has two logins:

- `contact@ebikeexchange.co.uk` — 27 orders are waiting for this email to confirm delivery availability. Last signed in 23 Sep.
- Chris's account — profile email `Chris@newportebikeexchange.co.uk`, but the actual sign-in email is `chris@newportcyclingrepairs.co.uk`. 1 order waits on the profile email.

The Bulk Availability page matches orders against the **sign-in email only**. So:

- If Chris signs in (as `chris@newportcyclingrepairs.co.uk`), the page matches that email against orders — finds nothing, shows "No orders pending availability confirmation", even though 28 orders are waiting across the company's two emails.
- The 27 orders under `contact@ebikeexchange.co.uk` only appear when signed in with that exact login.

## The fix

1. **Broaden the matching in `get_my_pending_availability_orders`** (database migration): match orders against both the account's sign-in email (`auth.users.email`) **and** the profile email (`profiles.email`) for the signed-in user. Chris would then see orders addressed to either of his emails.
2. **No change to the 27 orders** — they are correctly addressed to the business inbox `contact@ebikeexchange.co.uk`. The dealer should sign in with that account to confirm them (I'll tell you this so you can pass it on).

## Technical details

- Migration: `CREATE OR REPLACE FUNCTION public.get_my_pending_availability_orders()` — select both emails into variables, and change the `WHERE` clauses to `lower(o.sender->>'email') IN (SELECT lower(unnest(v_emails)))` (same for receiver). Keeps SECURITY DEFINER, STABLE, same return shape — no app code changes needed.
- No RLS or grant changes; function already exists with correct permissions.
- Verified data: 27 pending receiver orders for `contact@ebikeexchange.co.uk`, 1 for `chris@newportebikeexchange.co.uk`, 0 for `chris@newportcyclingrepairs.co.uk`.
