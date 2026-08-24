# Hide inspection report downloads for legacy inspections

Customers should only be able to download the inspection report PDF for inspections that happen from tomorrow (25 Aug 2026) onwards. Older inspections keep everything else, they just don't offer a report download — those legacy PDFs were generated before the report format was finalised.

Staff are unaffected: the Bicycle Inspections page keeps full access to every report, old or new.

## Where the customer-facing download appears today

1. Public tracking timeline ("View inspection report (PDF)") — link comes from the `get_public_inspection_summary` database function.
2. Public repair-offer page ("View inspection report (PDF)") — link comes from the `get_public_repair_offer` database function.
3. The approval email sent to the booking account — link built inside the `send-inspection-approval` edge function.

## Changes

- Add a single cutoff of `2026-08-25 00:00 Europe/London`.
- `get_public_inspection_summary`: return `report_url` only when the inspection's `created_at` is on or after the cutoff, otherwise return null. The tracking timeline already hides the button when there's no URL, so no frontend change is needed.
- `get_public_repair_offer`: apply the same cutoff to the `report_url` it selects. The repair-offer page already hides its button when the URL is absent.
- `send-inspection-approval`: only include the report link/button in the email when the inspection is on or after the cutoff; older inspections get the same email without the report link.

## Technical notes

- Both database functions change via one migration (`CREATE OR REPLACE`), keeping their existing `SECURITY DEFINER` / `search_path` settings and grants.
- The cutoff is expressed as a timestamptz literal so BST is handled correctly, and lives in one place per surface for easy adjustment later.
- Report generation and regeneration keep working for all inspections; only the customer-facing exposure of the URL is gated.
