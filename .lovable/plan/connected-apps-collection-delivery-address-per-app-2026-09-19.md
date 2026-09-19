# Connected apps: collection/delivery address per app

## What customers will see

On the profile page, the "Connected apps" section becomes visible and useful:

- Each connected app (e.g. Velodealer) is listed with when it was connected and last used.
- Under each app, the address we use when collecting from or delivering to that customer for jobs booked by that app.
- By default this shows the address on their profile, labelled as "Using your profile address".
- A "Change address" button opens a short form (address lines, city, county, postcode, plus optional contact name and phone) pre-filled with the profile address. Saving stores an app-specific address; a "Use profile address" option clears it and goes back to the default.
- Each app can have its own address.

## How it is used

When an app books a job through the partner API, it tells us which side of the job the customer is on (sender or receiver). We fill that side with the address saved against that app; if none is saved, we use the profile address. The other side comes from the app as today.

## Technical details

Database (migration):

- New table `public.oauth_grant_addresses`: `grant_id` (unique, FK to `oauth_access_grants`, cascade delete), `user_id`, contact name/phone, `address_line_1`, `address_line_2`, `city`, `county`, `postcode`, `country`, optional `lat`/`lon`, timestamps.
- GRANTs: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`; `ALL` to `service_role`. No `anon` grant.
- RLS enabled; policies scope every action to the owning `user_id` via a scalar `auth.uid()` subquery, with `WITH CHECK` on writes, and require the grant to belong to that user and be unrevoked.
- Extend `get_my_connected_apps()` to also return the saved address columns (null when unset) so one call feeds the card.
- New `set_my_connected_app_address(p_grant_id uuid, p_address jsonb)` (security definer, `search_path = public`): upserts the row when `p_address` is non-null, deletes it when null, after verifying the grant belongs to `auth.uid()` and is not revoked.

Frontend:

- `src/components/profile/ConnectedAppsCard.tsx`: render the address block per app, plus an edit dialog using existing shadcn `Dialog`/`Form` primitives and semantic tokens only. Pre-fill from `useAuth`/profile address when no override exists. Reuse the existing county/postcode validation used on the profile form.
- Card no longer returns null when the list loads empty only because of loading state; unchanged behaviour when the customer has no connected apps (stays hidden).

Partner API (`supabase/functions/orders/index.ts`):

- Resolve the grant for the presented OAuth token, read the app-specific address (fallback: the customer's `profiles` address), and apply it to whichever side the app marks as the customer (`customerSide: "sender" | "receiver"`, accepting the existing field if one is already sent).
- Geocoding, contact upsert, NI direction resolution and emails continue to run on the resolved sender/receiver objects, so ferry/NI routing and notifications behave as today.
- API-key (non-OAuth) callers keep current behaviour.

Docs: note the resolved-address behaviour and the customer-side field in `docs/API_DOCUMENTATION.md`.
