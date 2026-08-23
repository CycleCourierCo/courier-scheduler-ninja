# Hide the Geoapify key behind a server proxy

The mapping/address key is currently compiled into the browser bundle, so anyone visiting the site can copy it and run geocoding or route-optimisation calls billed to the account. The fix is to move every Geoapify call to the server, where the key stays private, and to rotate the exposed key.

## What changes for users

Nothing visible. Address autocomplete, geocoding, timeslot travel times and route optimisation all behave the same — the requests just travel via our own server instead of the browser calling Geoapify directly.

## Access rules for the new server endpoint

- Address autocomplete and single-address geocoding: available without signing in, because public booking/availability pages need it. Guarded by input limits (minimum 3 characters, max length, UK-only filter) and a per-IP request throttle.
- Route optimisation, multi-stop routing and travel-time lookups: staff sign-in required (same role gate used by the other operations endpoints).

## Technical detail

New edge function `supabase/functions/geoapify/index.ts`:
- POST with `{ action, params }`; actions: `autocomplete`, `geocode`, `routing`, `route-planner`.
- Reads the key from `GEOAPIFY_API_KEY` (already a server secret, used by the `orders` function); never returns the key.
- `routing` and `route-planner` call `requireOpsAuth`/`requireAuth` from `_shared/auth.ts`; `autocomplete`/`geocode` are open but throttled per IP with a small in-memory window and validated payloads.
- Forces `filter=countrycode:gb` server-side; passes through Geoapify's response body unchanged so existing parsing keeps working.
- CORS headers on every response, including errors; logs only action + status, no addresses.

Frontend refactor (all `import.meta.env.VITE_GEOAPIFY_API_KEY` reads removed):
- `src/utils/geocoding.ts` — call `geoapify` with `action: 'geocode'`.
- `src/services/routeOptimizationService.ts` (3 call sites) — `route-planner` for both optimisers, `routing` for `computeRouteInOrder`.
- `src/components/AddressForm.tsx` and `src/components/availability/AltLocationFields.tsx` — `autocomplete`.
- `src/components/scheduling/RouteBuilder.tsx` `calculateTravelTime` — `routing`.
- `src/components/admin/BusinessAccountsMap.tsx` — `geocode`.
- Add a small shared helper (`src/services/geoapifyClient.ts`) wrapping `supabase.functions.invoke("geoapify", …)` so all callers share one path.

Cleanup and key hygiene:
- Remove `VITE_GEOAPIFY_API_KEY` from `.env` so it stops being inlined into the bundle.
- Change `supabase/functions/shopify-webhook/index.ts` to read `GEOAPIFY_API_KEY` instead of `VITE_GEOAPIFY_API_KEY`.
- Because the old key was public, it must be rotated in the Geoapify dashboard and the new value saved as the `GEOAPIFY_API_KEY` secret — I will prompt for it after the code change. Until it is rotated, the leaked key remains usable by third parties.
- Verify the new endpoint live (autocomplete without auth, routing rejected without staff auth), then mark the security finding as fixed and update security memory.
