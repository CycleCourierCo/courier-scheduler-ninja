# Make registration collect everything "Fill in my details" needs

## What's wrong today

"Fill in my details" on the booking form only works if the account already has name, email, phone, address line 1 **and county/country**. Registration never asks for county or country, so a brand-new business account is sent to the profile page with "Please complete your profile first. Missing: country" the first time they try it.

Checked against the live data: of 158 business accounts, 101 have no country and no county stored, and 139 have no map coordinates.

The profile page does ask for county and country (both required there) — registration is the gap.

## What changes

1. **Registration address box gains County (required) and Country (defaulting to United Kingdom)**, matching the fields the profile page already requires. Both are saved to the new account at sign-up, so "Fill in my details" works straight after approval.
2. **Existing accounts stop being blocked**: where an account has an address but no country, treat it as United Kingdom instead of refusing to fill. County stays optional for filling (the form already falls back to address line 2).
3. **One-off tidy-up of existing accounts**: set country to "United Kingdom" for accounts that have an address but no country, so nobody is stopped by a field they were never asked for. County is left alone — it isn't required for the button once the fallback above is in place.

Coordinates are not part of this: the booking form geocodes the address when it's used, so a missing lat/long on the profile doesn't block anything.

## Technical notes

- `src/components/auth/RegisterForm.tsx`: add `county` (min 1) and `country` (default "United Kingdom") to `addressSchema` and defaults; render both inputs in the Address Information box next to City/Postal Code; add `county` and `country` to the sign-up metadata.
- Migration: extend `public.handle_new_user()` to write `county` and `coalesce(nullif(raw_user_meta_data->>'country',''),'United Kingdom')` into `profiles`. Columns already exist; no schema, grant or RLS change.
- Data fix (run_sql, not a migration): `update public.profiles set country = 'United Kingdom' where address_line_1 is not null and address_line_1 <> '' and (country is null or country = '')`.
- `src/pages/CreateOrder.tsx` `fillMyDetails`: drop `country` from the blocking `missingFields` check and keep the existing `userProfile.country || "United Kingdom"` fallback when setting the form value.

## Verification

- Register a test business account with county filled, approve it, and confirm "Fill in my details" populates contact and address without redirecting to the profile page.
- Confirm an older account with no county/country also fills successfully.
