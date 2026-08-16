# Driving licence details for drivers (DVLA Driver View)

## Is it the same as the vehicle (VES) call?

No — it is a different DVLA product with heavier requirements:

| | Vehicle lookup (VES) — what we use today | Driver View (the link you sent) |
|---|---|---|
| Auth | Single `x-api-key` header | OAuth2 access token (client id/secret from a DVLA token endpoint) **plus** an `x-api-key` |
| Access | Self-service API key | Requires enrolment/contract with DVLA (MyLicence family) |
| Consent | None needed | Driver consent is required to view their licence data |
| Input | Registration only | Driving licence number (plus driver-identifying fields such as NI number / date of birth, depending on the enrolled variant) |

So we cannot reuse `lookup-vehicle`'s pattern directly: we need a token-exchange step, token caching, and the extra secrets. Everything below assumes you have (or can get) DVLA Driver View credentials; the exact request/response fields will be confirmed against the developer portal as the first build step, since the spec differs between the enrolled variants.

## What gets built

1. **Data**: add licence columns to `profiles` — licence number, plus cached API results (licence status, valid from/to, entitlement categories, endorsements/penalty points, CPC and tacho details where returned, last refreshed timestamp, raw JSON) and a consent-recorded timestamp.
2. **Edge function `lookup-driving-licence`** (admin-only, mirroring `lookup-vehicle`'s JWT + `has_role('admin')` gate):
   - exchanges client credentials for a DVLA access token (cached in memory until expiry),
   - calls Driver View, normalises the response, writes it to the driver's profile,
   - returns the normalised details; never logs licence numbers or personal data.
3. **User Management → Edit User → new "Licence" tab** (shown when the user has the `driver` role):
   - inputs for licence number and any required identifying fields, plus a consent checkbox,
   - "Look up licence" button calling the edge function,
   - read-only details panel: status, name/DOB match, valid dates, entitlement category table (category, valid from/to, restrictions), endorsements with points and offence codes, CPC/tacho if present, and a "Last checked" stamp with a Refresh button,
   - clear expiry/points warnings (e.g. licence expiring within 60 days, 6+ points).
4. **Secrets**: `DVLA_DRIVER_VIEW_CLIENT_ID`, `DVLA_DRIVER_VIEW_CLIENT_SECRET`, `DVLA_DRIVER_VIEW_API_KEY` (and token URL if it differs per environment) — requested via the secure secret form once you confirm you have them.

## Technical notes

- Migration adds nullable columns to `public.profiles` only; existing admin-only RLS on `profiles` already restricts who can read them, so no policy changes beyond confirming admin-only visibility of the new fields in the UI.
- Files: new `supabase/functions/lookup-driving-licence/index.ts`, new `src/services/drivingLicenceService.ts`, edits to `src/components/user-management/EditUserDialog.tsx` (new tab gated on `isDriver`) and `src/types/user.ts`.
- Sandbox/testing: DVLA provides a test environment; if live credentials aren't available yet the UI ships with the lookup returning a clear "credentials not configured" message rather than failing silently.
