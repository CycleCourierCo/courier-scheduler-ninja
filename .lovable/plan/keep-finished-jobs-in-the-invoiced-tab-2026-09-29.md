# Keep finished jobs in the Invoiced tab

## What happened
When Inspection only was added, every existing job was marked "service accepted" (because they were all booked as Inspection and service). A new rule on the Bicycle Inspections page says "service accepted = still needs invoicing", so 134 finished jobs that had been settled without an invoice number (nothing to invoice, repairs declined, zero value, receiver-billed) dropped out of Invoiced and into Inspected and Serviced. The 179 jobs with an actual invoice number were not affected.

## Fix
- Only treat an accepted service as "still to invoice" for **Inspection only** jobs, where the customer actively chose to add a service after the inspection.
- Inspection and service jobs go back to the previous rules, so all 134 return to Invoiced straight away.
- Jobs with an invoice number, or marked "not invoiced", always stay in Invoiced (unchanged).
- No data changes are needed.

## Technical details
- `src/pages/BicycleInspections.tsx`, `getSettledReason`: change the `service_decision === 'accepted'` early return to apply only when `inspection.inspection_type === 'inspection_only'`.
- Verify: inspection_and_service / no-invoice finished jobs count in Invoiced (expected +134), Inspected and Serviced shrinks accordingly.
