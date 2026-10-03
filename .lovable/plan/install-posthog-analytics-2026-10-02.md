# Install PostHog analytics

## What you'll get
PostHog product analytics running alongside Sentry: page views, user identification, and autocapture of clicks across the app, with keys managed through Lovable's PostHog connector (no manual API keys in code).

## Steps

1. **Connect PostHog** — link your PostHog project via the Lovable connector (you'll pick or create a connection in the card that appears). This provides the project token and region (EU/US) as environment variables.

2. **Install the library** — add `posthog-js` to the project.

3. **Initialise on app start** (`src/main.tsx`):
   - Read the token and region from the connector environment variables.
   - Point at the correct PostHog host (`eu.i.posthog.com` or `us.i.posthog.com`).
   - Wrapped in try/catch like Sentry, so an ad-blocker or missing key never breaks the app.
   - Disable in nothing — works in preview and production, same as Sentry.

4. **Identify signed-in users** — in the auth context, call `posthog.identify()` with the user's id and email when they sign in, and `posthog.reset()` on sign-out, so journeys are tied to people.

5. **Page views** — PostHog's autocapture handles SPA page views automatically; verify with a quick browser run that events flow (or confirm no console errors if network is blocked in preview).

## Privacy note
PostHog autocapture records clicks and form interactions. The booking flow collects customer names, addresses and phone numbers, so I'll mask sensitive inputs (PostHog's `mask_all_element_attributes` on payment/personal-detail fields) rather than capture everything raw.

## Out of scope
Dashboards, funnels and feature flags — you'll build those in PostHog itself once data is flowing.
