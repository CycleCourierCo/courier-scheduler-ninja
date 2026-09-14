# Customer inspection report download + fix the "View order" button

## 1. Let customers download the inspection report

Right now the report PDF only reaches customers through the public tracking timeline, the receiver repair-offer page, and the approval email. When a booking customer is signed in and looking at their own job — either on the Bicycle Inspections page (where they approve repairs) or on their order page — there is no way to open the report.

Changes:
- On the Bicycle Inspections page, add a "View inspection report (PDF)" button for the customer who owns the job, shown once the inspection has been released to them and a report exists.
- On the customer order page (`/customer-orders/:id`), add the same button in the inspection/services area when the job's inspection has been released and has a report.
- Keep the existing rule that reports are only offered for inspections from 25 August 2026 onwards; older jobs show no button.
- Staff behaviour is unchanged — they keep full access to every report at any stage.

## 2. "View order" button not working

Confirmed cause: on the Bicycle Inspections page the "View order" button navigates to the staff order page `/orders/:id`, and the permission matrix denies that page to business-customer accounts, so the customer lands on the access screen instead of their order.

Fix: send customers to their own order page `/customer-orders/:id` and keep staff going to `/orders/:id`. Also update the approval email, which already points at `/customer-orders/:id`, only if needed — it is correct today.

## Technical notes

- `src/pages/BicycleInspections.tsx`: choose the destination from the viewer's role (staff → `/orders/:id`, otherwise `/customer-orders/:id`); add a report button driven by `inspection.report_url` + `released_to_customer_at`, routed through `toPublicFileUrl`, gated by the existing 25 Aug 2026 cutoff for non-staff.
- `src/pages/CustomerOrderDetail.tsx`: fetch the order's latest inspection `report_url` / `released_to_customer_at` / `created_at` (via the existing public inspection summary function, which already applies the cutoff) and render the button when a URL comes back.
- No database or edge-function changes needed; the cutoff already lives in `get_public_inspection_summary`.

## Verify

- Sign in as a business customer, open an inspection with a report: "View order" opens their order page, and the report button opens the PDF.
- Same page as admin: "View order" still opens the staff order page and all reports remain available.
