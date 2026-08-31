# File links on api.cyclecourierco.com + report link for repair approvals

## 1. All file links use the api domain

Every storage link is currently produced against the raw Supabase project host (`https://axigtrmaxhetyfzjjdve.supabase.co/storage/v1/...`), because both `createSignedUrl`/`getPublicUrl` and the manual URL builder use the project URL. Fix it in one place on each side, then route every call site through it.

New helpers:
- `supabase/functions/_shared/publicFileUrl.ts` — `toPublicFileUrl(url)`: rewrites only the origin to the public API host (default `https://api.cyclecourierco.com`, overridable with a `PUBLIC_API_URL` env var). Path, signing token and query string are untouched, so signed links keep working. Non-Supabase or empty URLs pass through unchanged.
- `src/lib/publicFileUrl.ts` — same function for the frontend, using `VITE_PUBLIC_API_URL` with the same default.

Call sites to wrap (all links found in the codebase):
- Edge functions: `_shared/inspectionReport.ts` (report signed URL, both returned and saved to `bicycle_inspections.report_url`), `get-foam-photo-urls` (delivery/foam photo signed URLs).
- Frontend: `src/utils/uploadFile.ts` (manual public object URL), `src/services/fuelInvoiceService.ts`, `src/services/claimsService.ts`, `src/services/mechanicTimeslipService.ts`, `src/components/boxmybike/FoamMyBikeSection.tsx` (both), `src/components/user-management/DriverLicenceTab.tsx`, `src/components/order-detail/TrackingTimeline.tsx` (foam photo signed URLs), `src/pages/BoxMyBikePage.tsx` (label link).

Notes:
- Links already stored in the database (e.g. older `report_url`, uploaded file URLs) keep the old host until regenerated/re-uploaded; they continue to work.
- Requires the Supabase custom domain `api.cyclecourierco.com` to serve `/storage/v1` — it is already the host used for `/functions/v1` in the API docs/Postman environment, so no DNS work.
- Redeploy `inspection-report`, `get-foam-photo-urls` and the inspection flow functions that regenerate the report.

## 2. Report link for the customer approving repairs

Today:
- The approval email to the booking account does include a "View the full inspection report (PDF)" link, but its "Review and approve repairs" button points at the staff page `/bicycle-inspections`.
- The public receiver repair-offer page (`/repair-offer/:id`) shows no report link at all.

Changes:
- Extend `get_public_repair_offer` to also return the inspection's `report_url` (report only, nothing else new).
- On `/repair-offer/:id`, add a "View inspection report (PDF)" button near the repair list when a report URL is present, so the person approving can see the checklist and findings before deciding.
- Point the approval email's button at the customer's own order page (`/orders/:id`) instead of the staff inspections page, and keep the PDF link alongside it.

## Verify

- Type check, then regenerate one inspection report and confirm the stored URL starts with `https://api.cyclecourierco.com/storage/v1/...` and opens.
- Open a repair offer link and confirm the report button appears and opens the PDF.
