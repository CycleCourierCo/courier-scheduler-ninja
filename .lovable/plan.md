# Add accounts email and opening times to business registration

## What changes

On the Log in / Register page, the business registration form gains:

1. **Accounts email (optional)** — in the Business Information box, under Company/Trading Name. This is the address invoices go to. If left blank, invoicing keeps falling back to the main email as it does today.
2. **Opening times** — a new "Opening Hours" box using the same day-by-day editor staff already use in the account editor: a switch per day, an optional "24h" switch, and start/end times. It starts from the standard Mon-Fri 9:00-17:00, weekend closed. Fridays are not shown, matching the existing editor (Friday availability is controlled separately by us).

Both values are saved against the new account at sign-up, so they are already filled in when an administrator reviews the pending application, and route planning immediately sees the business's real opening times instead of the default.

Nothing else about registration changes: it stays business-only, still needs admin approval, and existing accounts are untouched.

## Technical notes

- `src/components/auth/RegisterForm.tsx`: extend the zod schema with `accounts_email` (optional, email format when non-empty) and `opening_hours` (defaulted to `DEFAULT_OPENING_HOURS`); render the accounts email input and `OpeningHoursEditor` (controlled via `form.watch`/`setValue`); include `accounts_email` and `JSON.stringify(opening_hours)` in the sign-up metadata passed to `signUp`.
- Migration: update `public.handle_new_user()` to also write `accounts_email` (`new.raw_user_meta_data->>'accounts_email'`, null when empty) and `opening_hours` (`(new.raw_user_meta_data->>'opening_hours')::jsonb`, falling back to null when absent). Columns already exist on `profiles`; no schema change, no RLS/grant change.
- No changes to `get_business_opening_hours`, RouteBuilder, or the invoicing paths — they read the same columns.

## Verification

- Register a test business account with an accounts email and altered hours; confirm the profile row carries both, and that the account editor shows them.
- Register without an accounts email; confirm sign-up succeeds and the field is empty.
