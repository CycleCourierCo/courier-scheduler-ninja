# Geo-check the postcode when availability is confirmed

## What changes

When a sender or receiver confirms their availability, the app will look up the coordinates for their address (using the postcode they typed plus the address on the order) and store them on the order. That way every stop has a reliable lat/long for route planning, even for orders that were imported or booked without coordinates.

Behaviour:
- On submit, if the side's address has no lat/long, geocode `street, city, postcode` (UK-filtered) and save the result.
- If the address already has coordinates, keep them (no overwrite) unless the postcode the customer entered differs from the stored one — in that case re-geocode and update.
- If the workplace alternate address was picked but has no coordinates, geocode it too before saving.
- Geocoding never blocks confirmation: if the lookup fails, availability still saves as today.

## Technical notes

- `src/utils/geocoding.ts` — reuse `geocodeAddress` / `buildAddressString`; add a small `geocodePostcodeAddress(street, city, postcode)` helper that falls back to postcode-only lookup when the full-address search returns nothing.
- `src/services/availabilityService.ts` — in `updateSenderAvailability` / `updateReceiverAvailability` (and the `confirm*Availability` paths), before calling the RPC:
  - read the current side's address from the public order payload (`get_public_order`) to get street/city/existing lat/lon;
  - resolve coordinates per the rules above;
  - pass them to the RPC as new optional args `p_lat numeric`, `p_lon numeric`.
  - Also geocode `altLocation.work_address` when `lat`/`lon` are null before it is sent.
- Migration: `CREATE OR REPLACE FUNCTION public.set_order_availability(..., p_lat numeric DEFAULT NULL, p_lon numeric DEFAULT NULL)` keeping all existing logic (auth, rate limit, postcode match, status transitions) unchanged, and, when both values are non-null, writing them into the side's JSONB address via `jsonb_set` on `sender->'address'` / `receiver->'address'` (`lat`, `lon`), plus the flat `sender_address`/`receiver_address` coordinate fields if present on the row.
- No new tables, so no grants needed; the function stays `SECURITY DEFINER` with `search_path = public`.
- `_build_public_order_payload` already exposes the sender/receiver objects used to read the existing address, so no payload change is expected; if the address block turns out to be redacted for guests, the geocode input falls back to the entered postcode alone.
