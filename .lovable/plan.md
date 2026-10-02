# PostHog on the Vercel live site

The PostHog tracking code is already built into the app, but it reads its keys from Lovable connector variable names that don't exist on Vercel. This makes it work in both places.

## Changes

1. **Support standard variable names** — update `src/lib/posthog.ts` so it also reads `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` (the names you'd set on Vercel), falling back to the existing Lovable connector variables. Lovable preview keeps working unchanged.

2. **You add the keys in Vercel** (one-time, in your Vercel dashboard — I can't do this part for you):
   - Vercel project → **Settings → Environment Variables**
   - Add `VITE_POSTHOG_KEY` = your PostHog project API key (from PostHog → Project Settings, starts with `phc_...`)
   - Add `VITE_POSTHOG_HOST` = `https://eu.i.posthog.com`
   - Set them for **Production** (and Preview if you want)
   - Redeploy (Vercel → Deployments → Redeploy) so the variables are baked into the build

3. **Verify** — after redeploy, browse the live site and confirm events appear in the PostHog dashboard.

## Notes

- Same privacy guards apply on the live site: form field values masked, session recording off.
- If the variables aren't set, the site runs exactly as before — no errors, just no analytics.
- Nothing else about the Vercel deployment changes.

## Technical details

- File touched: `src/lib/posthog.ts` only (env var lookup order: `VITE_POSTHOG_KEY` → `VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY`; host: `VITE_POSTHOG_HOST` → connector region → EU default).
- No new dependencies; `posthog-js` is already installed.
