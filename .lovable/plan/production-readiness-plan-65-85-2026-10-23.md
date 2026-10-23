# Production readiness plan (65 -> 85+)

Four phases, done in order. Each phase ends with a short report of what changed and what is still open.

## Phase 1 - Security (biggest gap)
1. Go through the ~135 background actions that anyone can reach. Sort each one into three groups: public by design (tracking, availability, repair offer), staff only, or system only. Lock the last two groups.
2. Check that incoming messages really come from who they claim to (email, WhatsApp, webhooks). Reject any that aren't signed.
3. Stop using the old "role" field on profiles for access decisions. Use the proper role check everywhere.
4. Move the Geoapify map key off the browser, behind a sign-in protected step, then replace the key with a new one.
5. Limit the settings tables (fuel cards, workshop settings, page permissions) to staff only.
6. Check file uploads by file type and size. Block SVG files.
7. Run the security scan again. Fix or explain every remaining warning.

## Phase 2 - Tests for rules that affect money and customers
Add small automated tests for:
- Prices: per bike type, Matthew Coulthard £65 / £150 from 13 Sep 2026, Recumbent £100, Small Trike £125, storage £40 a month.
- Whether a weekly invoice is raised for an inspection or not.
- Chaser rules: receiver waits for sender dates and for workshop sign-off, plus the 24-hour gap between reminders.
- Repairs declined going to Awaiting repair.
- Clean Air Zone charges: once per van, zone and day, and none for exempt vans.

## Phase 3 - Check that recent changes work in real use
A checklist with a short test for each change:
- Edit User sign-in email
- Admin date editing
- eBay fields on Edit Bikes
- Shipday home/work address choice
- Sending files by WhatsApp
- Route planners editing the rota
- Customer service adding inspections

Anything that fails gets fixed.

## Phase 4 - Running it day to day
- Alerts when scheduled jobs (weekly invoices, chasers, Clean Air Zone checks, proof backfill) fail or don't run.
- Finish the privacy policy fixes: PostHog, Sentry and Gemini, the office address, and retention.
- SMS: done once Divergent approves the sender name (this waits on Divergent).

## Technical notes
- Endpoint class (PUBLIC/USER/INTERNAL) is written at the top of each function. A CI check fails the build when a function with `verify_jwt = false` has no class, or when a USER/INTERNAL function has no `_shared/auth.ts` gate.
- Tests use the project's existing test runner, one test per rule, with the exact values above.
