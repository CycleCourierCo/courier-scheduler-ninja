# PDI inspection report PDF, tracking link, and approval email

Three connected pieces: a printable inspection report, a customer-visible link to it on tracking when issues are found, and an automatic approval request email to the booking account.

## 1. Printable PDI report PDF

A one-tap "Download report" / "PDF" action on each inspection card in Bicycle Inspections produces an A4 PDF containing:

- Header: Cycle Courier Co. branding, tracking number, bike brand/model/type, bike category, sender and receiver names.
- Inspection details: who inspected it, date/time (Europe/London), and current stage.
- PDI summary table: every section with each item's result (Pass / Advisory / Fail) and any note, taken from the inspection notes saved at completion.
- Issues table: description, part name/number where present, parts cost, labour cost, total, and status (pending / approved / declined / resolved), with a grand total.
- Footer: generated timestamp, page numbers, and company registration details.

The button is available for any inspection that has been carried out (inspected or later), for admins and mechanics.

## 2. Tracking link when issues are found

When an inspection is released to the customer (moves into "issues found"), the report is also uploaded to storage and its link is saved on the inspection. The public tracking page then shows an "Inspection report" card with:

- A short line: "Our workshop found N item(s) needing attention."
- A "View inspection report (PDF)" button opening the stored PDF.

The link only appears once issues have been released to the customer — never while pricing is still in progress. Regenerating on release replaces the previous file so the link always points to the current report.

## 3. Approval request email to the booking account

As soon as an inspection is released and is awaiting approval, an email goes to the account that booked the order (the order's owning account, not the receiver):

- Subject: repairs needed on the bike, with the tracking number.
- Body: bike details, a table of each issue with parts/labour/total, the overall total, a "Review and approve repairs" button linking to the approval page, and the inspection report PDF link.
- Sent from `notification.cyclecourierco.com` with reply-to `Info@cyclecourierco.com`.
- Sent once per release, recorded on the inspection so re-releasing doesn't spam; a manual "Resend approval email" button is available to admins.
- Suppressed for test accounts, matching existing behaviour.

## Technical notes

**PDF generation** — new `src/utils/inspectionReportPdf.ts` using the existing `jspdf` dependency (already used by `labelUtils.ts`):
- `buildInspectionReportPdf(order, inspection, issues): jsPDF` — parses the stored PDI notes text back into section/item/result rows, draws the tables manually (no autotable dependency), returns the document.
- `downloadInspectionReport(...)` for the client button, and `inspectionReportBlob(...)` for upload.

**Storage + database** — one migration:
- Public storage bucket `inspection-reports` with read access for everyone and write restricted to service role / staff.
- New columns on `bicycle_inspections`: `report_url text`, `report_generated_at timestamptz`, `approval_email_sent_at timestamptz`.
- Extend the existing `get_public_inspection_summary` and `get_public_order` SQL functions to include `report_url` in the returned summary so tracking can render the link without exposing anything else.

**Release flow** — `src/services/inspectionService.ts`:
- `releaseInspectionToCustomer` gains a post-step: generate the PDF client-side, upload to `inspection-reports/<order_id>.pdf` (upsert), save `report_url`/`report_generated_at`, then invoke the new edge function.
- New `requestInspectionApproval(inspectionId)` helper for the manual resend button.

**Email** — new edge function `supabase/functions/send-inspection-approval` (CORS headers, JWT-authenticated with admin/mechanic role check, service-role client, `EdgeRuntime.waitUntil` for the send):
- Loads order, inspection and pending issues; resolves the booking account email from `orders.user_id` → `profiles`.
- Renders the issue table and sends via Resend, then stamps `approval_email_sent_at`.
- No PII in logs.

**UI**
- `src/pages/BicycleInspections.tsx`: "PDF" button on inspected/later cards; "Resend approval email" for admins on issues-found inspections.
- `src/pages/TrackingPage.tsx`: inspection report card driven by `inspectionSummary.has_issues` + `report_url`.
- `src/types/inspection.ts`: add the three new fields and `report_url` on `InspectionSummary`.
