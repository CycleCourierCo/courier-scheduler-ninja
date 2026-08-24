# Serve the inspection report PDF from api.cyclecourierco.com

## Current behaviour (verified)

`supabase/functions/_shared/inspectionReport.ts` uploads the PDF and calls `createSignedUrl`, which returns a link on the raw Supabase project host (`https://axigtrmaxhetyfzjjdve.supabase.co/storage/v1/...`). That URL is stored in `bicycle_inspections.report_url` and used in emails and the UI.

## Change

- Add a small helper in the shared file that rewrites the host of any generated storage URL from the Supabase project URL to `https://api.cyclecourierco.com` (the existing Supabase custom domain already used for `/functions/v1`). Path, token and query string stay untouched, so the signed link keeps working.
- Apply it to the signed URL before it is returned and before it is saved to `report_url`.
- Make the public host configurable via an optional `PUBLIC_API_URL` env var, defaulting to `https://api.cyclecourierco.com`, so it can be changed without a code edit.
- Existing rows keep their old `report_url` until the report is regenerated; regeneration (the "Regenerate report" action / inspection flow) produces the new domain.

Only `inspection-report` and the inspection flows that call `regenerateInspectionReport` need redeploying.

## Answer on the checklist

Yes — the report already renders the full PDI checklist. Under "Inspection checklist" it prints each section heading and every item with a colour-coded `PASS` (green), `ADVISORY` (amber) or `FAIL` (red) tag plus any comment, then "General notes", then a "Work identified" table with each repair's decision (Completed / Approved / Declined / pending). If an inspection has no parsable checklist notes, it falls back to printing the raw notes text.
