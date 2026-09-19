# One-time Vercel refresh with Supabase sign-out

## Confirmed setup
- The frontend is deployed on Vercel and authentication is provided by Supabase.
- Vercel already revalidates every page request while caching hashed `/assets/*` files immutably, which is the correct cache policy for a Vite release.
- Supabase sessions persist in the browser and automatically refresh.
- The app has no active service worker, but the reset will remove any legacy registrations and Cache Storage left on customer devices.

## Implementation
1. Keep the one-time release reset in the application startup.
   - On the first visit to this Vercel release, silently clear the local Supabase session, browser Cache Storage, legacy service workers, and in-memory application data.
   - Mark that browser as reset and reload once with a release identifier, preventing loops even when Safari blocks browser storage.
   - Show no update notice, toast, or banner.
2. Keep Vercel's existing cache policy.
   - HTML continues using `max-age=0, must-revalidate` so each navigation checks for the latest release.
   - Fingerprinted assets remain long-lived because each build creates new filenames.
3. Deploy through the project's normal GitHub-to-Vercel workflow, not Lovable publishing.
4. After Vercel reports the production deployment ready, invalidate existing Supabase sessions using Supabase's supported authentication controls only.
   - Do not edit the reserved `auth` schema directly.
   - Do not affect API keys, partner OAuth tokens, user accounts, or business data.
5. Verify production on desktop and mobile: one silent reload, signed-out state, latest asset filenames, no reload loop, and public tracking still available.

## Rollout limitation
A browser tab that remains open without making any request cannot be remotely refreshed at that exact moment. Its Supabase session will become invalid after central revocation, and the latest application will load when the tab next navigates, reloads, or reopens.
