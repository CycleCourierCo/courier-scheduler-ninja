# Publish the new privacy policy

Replace the short 2025 privacy policy page with the new full UK GDPR policy the user supplied, after fixing the mismatches between what the policy says and what the app actually does.

## Fixes to the policy text before publishing

1. **Cookies/analytics** — the app uses PostHog analytics, so "We do not use analytics, advertising or tracking cookies" is inaccurate. Options: (a) soften the wording to name PostHog as an analytics provider with a consent/opt-out note, or (b) disable PostHog cookie persistence so the statement stays true. Recommend (a).
2. **Providers list** — add Sentry (error tracking, US) and the AI route-planning provider (Gemini) to section 6 so the recipient list matches reality.
3. **Registered office** — policy says Izabella House, 24–26 Regent Place, B1 3NJ; the app's email footers say 30 Wake Green Road, B13 9PB. Confirm which is current and make both match. [CONFIRM with user]
4. **Retention promises** — the policy commits to deleting proof-of-delivery photos after 2 years, CCTV after 30 days, health notes after job completion, etc. No automated deletion exists today. Either implement deletion jobs (bigger piece of work, separate plan) or keep the policy as the stated standard and track the gap openly. Recommend publishing the policy as-is and scheduling the retention work separately.

## Changes

- `src/pages/PrivacyPolicyPage.tsx`: replace the current content with the new policy (all 20 sections), keeping the existing page layout and card styling. Update "Last updated" to 12 Oct 2026.
- `src/lib/posthog.ts`: check cookie/storage persistence config; align with whichever cookie wording is chosen.
- No database, email or footer changes except the registered-office fix once confirmed.

## Verification

- View `/privacy-policy` in the preview and confirm all sections render correctly on desktop and mobile widths.
- Confirm no other page links to policy sections that no longer exist.

## Open questions

- Which registered office address is current?
- Keep PostHog analytics (name it in the policy) or strip it back to essential-only?
