# PostHog on the Vercel live site

Your live site is served from Vercel (the project already has a `vercel.json`), and the PostHog tracking code is already built into the app — but it reads its keys from a Lovable connector variable that doesn't exist in the Vercel build, so the live site currently sends nothing. This makes it work in both places.

## Changes

1. **Support standard variable names** — update `src/lib/posthog.ts` so it also reads `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` (the names PostHog/Vercel use), falling back to the existing Lovable connector variables. The Lovable preview keeps working unchanged, and a missing variable still means no analytics rather than an error.

2. **You add the keys in Vercel** (one-time, in your Vercel dashboard — I can't do this part for you):
   - Vercel project → **Settings → Environment Variables**
   - Add `VITE_POSTHOG_KEY` = your PostHog project API key — the `phc_...` token, the same one already in the project's `.env`, also found in PostHog → Project Settings
   - Add `VITE_POSTHOG_HOST` = `https://eu.i.posthog.com`
   - Set them for **Production** (and Preview if you want)
   - Redeploy (Vercel → Deployments → Redeploy) so the variables are baked into the build

3. **Verify** — after redeploy, browse the live site and confirm events appear in the PostHog dashboard.

## Notes

- Same privacy guards apply on the live site: form field values masked, session recording off.
- If the variables aren't set, the site runs exactly as before — no errors, just no analytics.
- Nothing else about the Vercel deployment changes; no PostHog snippet goes into `index.html`.

## Technical details

- File touched: `src/lib/posthog.ts` only (env var lookup order: `VITE_POSTHOG_KEY` → `VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY`; host: `VITE_POSTHOG_HOST` → connector region → EU default).
- No new dependencies; `posthog-js` is already installed and bundled.

