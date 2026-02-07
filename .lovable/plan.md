
## What’s happening (why “Get timeslot” only adds 15 minutes)
- Your Route Builder calculates **travel time** by calling Geoapify in the browser (`fetch("https://api.geoapify.com/v1/routing?...")`).
- That request is currently **blocked by the browser** due to CORS:
  - Geoapify’s CORS preflight response does **not** allow the request header `sentry-trace`.
  - Sentry is adding `sentry-trace` (and usually `baggage`) because your Sentry config explicitly enables trace header propagation to Geoapify.
- Because the fetch fails, the code falls back to a **default 15 minutes** travel time:
  - `calculateTravelTime(...)` catches the error and returns `15`
  - So you end up seeing only the fixed **service time** behavior and/or the fallback behavior, instead of real between-stop travel times.

## Root cause in your codebase
In `src/main.tsx`, Sentry is configured with:
- `tracePropagationTargets: [..., /^https:\/\/api\.geoapify\.com/]`

That tells Sentry: “attach tracing headers to requests to Geoapify”.
Geoapify blocks those headers via CORS → the request fails → travel time becomes the fallback 15 minutes.

## Fix (recommended): stop sending Sentry trace headers to Geoapify
### Change
Update `src/main.tsx`:
- Remove Geoapify from `tracePropagationTargets`:
  - Remove this entry:
    - `^https:\/\/api\.geoapify\.com`

### Why this works
- The browser will no longer include the `sentry-trace` header on Geoapify requests.
- The CORS preflight will succeed.
- `calculateTravelTime` will receive real routing data and return actual travel time minutes.

### Notes
- This does **not** disable Sentry in general.
- It keeps trace propagation to Supabase (good) while avoiding a third-party CORS limitation.

## Implementation steps (code changes)
1. **Edit** `src/main.tsx`
   - In `Sentry.init({ ... tracePropagationTargets: [...] })`
   - Remove the Geoapify regex target:
     - From:
       - `tracePropagationTargets: ["localhost", /^https:\/\/axigtrmaxhetyfzjjdve\.supabase\.co/, /^https:\/\/api\.geoapify\.com/]`
     - To:
       - `tracePropagationTargets: ["localhost", /^https:\/\/axigtrmaxhetyfzjjdve\.supabase\.co/]`
2. (Optional but nice) Add a short comment explaining why Geoapify is excluded (CORS).

## Verification steps (how we’ll confirm it’s fixed)
1. Go to **/scheduling**
2. Build a route and click **Get timeslot**
3. Confirm in DevTools:
   - No CORS error mentioning `sentry-trace`
   - The Geoapify request returns `200`
4. Confirm behavior:
   - Times between stops are no longer always 15 minutes (they should vary depending on distance/traffic)
5. Re-test your example order (CCC754608952426BEDCH5) route timing

## If it still fails after this (backup plan)
If Geoapify still blocks requests for other reasons (less likely given the specific error), we’ll implement a **Supabase Edge Function proxy** for Geoapify routing:
- Frontend calls our edge function (same origin / allowed headers)
- Edge function calls Geoapify server-to-server (no browser CORS)
- Also lets us keep the Geoapify key off the client if desired

## Technical reference (where the timing fallback comes from)
- `src/components/scheduling/RouteBuilder.tsx`
  - `calculateTravelTime()` returns `15` minutes on any error (including CORS fetch failures)
  - That’s why the timing only increases by the stop/service time + fallback travel time
