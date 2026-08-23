# Tidy up the PDI inspection report PDF

Two changes to the generated pre-delivery inspection report:

1. **Remove sender and receiver** from the details block at the top. The block keeps Bike, Type, Quantity, Inspected by, Inspected at and Stage.
2. **Remove the footer** on every page — the "Generated … Cycle Courier Co. Ltd · No pricing shown on this report" line and the "Page X of Y" numbering.

## Technical notes

- `supabase/functions/_shared/inspectionReport.ts`: drop the `Sender` and `Receiver` rows from the `details` array (the block auto-sizes, so the box shrinks to 3 rows), and delete the per-page footer loop near the end of the PDF builder.
- Redeploy the functions that use the shared builder (`inspection-report` and any inspection flow that regenerates the report) so existing jobs regenerate in the new format.
