# One-time global sign-out and refresh

## Goal
Move every portal user onto the latest release once, without adding a permanent admin control.

## Current behaviour confirmed
- Sign-in uses persistent Supabase sessions with automatic token refresh.
- A normal sign-out clears the browser session and the signed-in data cache.
- The app already retries once when an old lazy-loaded file disappears after a release.
- There is no service worker/PWA cache worker and no existing global release/session-version control.
- Supabase has active session and refresh-token stores that can be invalidated centrally.

## Implementation
1. Add a one-time release marker to the app bootstrap.
   - On the first load of this release, unregister any legacy service workers, clear browser Cache Storage, clear the app's query cache, and remove the existing Supabase browser session.
   - Store the marker locally so this only happens once per browser and does not create a reload loop.
   - Reload once with a release query parameter so the browser requests the current HTML and hashed assets.
2. Invalidate existing Supabase user sessions and refresh tokens centrally when the release is ready.
   - This forces users on other devices or stale open tabs to authenticate again when their session is checked or refreshed.
   - Do not touch partner OAuth tokens, API keys, customer data, or user accounts.
3. Send users to sign-in with a clear message explaining that the portal was updated and they need to sign in again.
4. Build and verify the flow in desktop and mobile browsers, including blocked-storage/Safari-safe fallbacks and protection against reload loops.
5. Publish the release first, then perform the one-time session invalidation so nobody is forced back into the older version.

## Expected impact
- All currently signed-in portal users will need to sign in again once.
- Public tracking and other unsigned links remain available.
- Unsaved form changes in open tabs can be lost when those tabs refresh; the release should therefore be done at a quiet time.
- Browsers that are completely closed will receive the reset on their next visit.
