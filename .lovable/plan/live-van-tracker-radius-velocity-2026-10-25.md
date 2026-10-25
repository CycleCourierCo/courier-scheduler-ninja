# Live Van Tracker (Radius Velocity)

A new Fleet page that shows every van on a map, where it is right now, so you don't need to open Radius.

## What you'll see
- **Fleet > Live map** (admins and fleet managers only; also linked from the Fleet dashboard).
- A map of all vans, one pin each, labelled with the registration. Green = engine on and moving, amber = engine on but stopped, grey = engine off. If the last position is more than 30 minutes old, the pin is faded and marked "last seen".
- A list beside the map (below it on phones): registration, driver, speed, street/town/postcode, and "updated x min ago". Tap a van to zoom to it and open its Fleet page.
- Vans are matched to Fleet vans by registration, so open red defects or off-road status show as a small warning badge on the pin.
- Refreshes on its own every 60 seconds while the page is open, plus a Refresh button.
- A "Not in Fleet" note for any tracker whose registration doesn't match a van, so mismatches are easy to fix.

## What you need to supply
1. Your **Radius Velocity Refresh Token** (from the Radius Velocity Portal, for the telematics product). I'll ask for it in a secure form; it's never shown in the app.
2. Your **Radius customer ID**. If you don't have it, the first run will try to look it up from your account; if that isn't possible I'll ask you for it.

## How it stays signed in
- The app swaps the refresh token for an access token, stores it privately, and gets a new one before the 30-day expiry.
- Because the app uses the refresh token regularly, Radius won't revoke it for being unused.
- If Radius rejects the token, the page says "Radius connection needs a new token" instead of a blank map.

## Not included (can add later)
- Saving a location history or trip replay (this is live positions only).
- Showing van locations to drivers or route planners.
- Using live positions in route planning or ETAs.

## Technical details
- Edge Function `radius-positions` (JWT required; caller must be admin or fleet_manager via `is_fleet_staff`). Reads secret `RADIUS_REFRESH_TOKEN` and `RADIUS_CUSTOMER_ID`; POSTs form `token=` to `https://www.velocityfleet.com/vapi/v1/accounts/users/oauth2/refresh/`, then POSTs `/api/mobile/kinesis/device-live-positions/?customer=…&useUTC` with Bearer token.
- Access token cached in a service-role-only table `fleet_integration_tokens` (provider, token, fetched_at); refreshed when older than 25 days or on a 401 (one retry).
- Response trimmed server-side to: id, registration (normalised: upper-case, no spaces), lat, lon, ignition, speed, direction, street, town, post_code, driver_name, timestamp. Phone numbers and other fields dropped. `private: true` devices are excluded. No positions or names written to logs.
- A 20-second in-memory cache in the function so several staff viewing at once don't hit Radius repeatedly.
- Daily cron (X-Cron-Secret) calls a token keep-alive so the refresh token is used even if nobody opens the page.
- Frontend `src/pages/fleet/LiveMap.tsx` using existing Leaflet setup and `colouredMarkerIcon`; route added to routes config and `ADMIN_MENU_SECTIONS`; semantic colour tokens only.
- Registration matching helper in `src/lib/fleet/liveTracking.ts` with vitest tests (normalisation, stale threshold 30 min, ignition/speed to status).
- AGENTS.md rule: Radius tokens live only server-side; browser gets trimmed positions through the staff-only function.
