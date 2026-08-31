# Make all customer file links use api.cyclecourierco.com

## What's wrong

Report/file links generated *now* are rewritten to `api.cyclecourierco.com`, but links read back out of the database are not. `bicycle_inspections.report_url` rows stored before the rewrite was added still hold raw `*.supabase.co` URLs, and the tracking timeline renders `summary.report_url` straight through without passing it through the rewrite helper. Same for the staff inspections page and the approval email.

## Fix

1. **Tracking timeline** (`src/components/order-detail/TrackingTimeline.tsx`): pass the inspection `report_url` through `toPublicFileUrl` before using it for the three "View inspection report (PDF)" links.
2. **Receiver availability page**: apply the same rewrite anywhere it surfaces a report or file link from the inspection summary.
3. **Staff inspections page** (`src/pages/BicycleInspections.tsx`): wrap both `window.open` calls (freshly generated `report_url` and `external_report_url`) in `toPublicFileUrl`.
4. **Approval email** (`supabase/functions/send-inspection-approval`): wrap the `report_url` read from the DB with the shared edge helper before putting it in the email, then redeploy.
5. **Harden both helpers** (`src/lib/publicFileUrl.ts`, `supabase/functions/_shared/publicFileUrl.ts`): in addition to matching the configured project origin, also rewrite any host ending in `.supabase.co` (and `.supabase.in`) so legacy or hand-built URLs are caught regardless of environment config.
6. **Sweep**: check remaining places that expose storage URLs (Box My Bike labels, foam photos, claims, fuel invoices, mechanic timeslips, driver licences, third-party courier tracking link) and confirm each goes through the helper; add it where missing.

## Verification

- Open a tracking link for an inspected order and confirm the report link host is `api.cyclecourierco.com` (both a legacy inspection and a new one).
- Confirm the repair-offer page and approval email links use the same host.
