# Notes on inspections at any stage

## The problem

Notes only appear on a bike once a workshop inspection record exists. Bikes sitting in the "Awaiting inspection" and "Collected" groups usually have no inspection record yet, so the Notes box is hidden and staff can't leave a note until someone starts the inspection.

## What changes

- The Notes box shows on every bike card in the inspections page and in the Inspect and Service section on the order page, at every stage — including before inspection has started.
- Notes written before the inspection starts stay attached to the bike and keep showing once the inspection begins, in date order alongside later notes.
- Nothing else about notes changes: same authors, same timestamps, author or admin can delete.

## Technical notes

Data:
- Make `inspection_comments.inspection_id` nullable (`order_id` stays required) so a note can exist before a `bicycle_inspections` row.
- Backfill nothing; existing rows keep their inspection link.
- RLS/grants unchanged (already internal-staff read/insert, author-or-admin delete).

Frontend:
- `src/components/inspections/InspectionComments.tsx`: accept `inspectionId?: string | null`, always query by `order_id` (covers both pre- and post-inspection notes), and insert with `inspection_id: inspectionId ?? null`.
- `src/pages/BicycleInspections.tsx` (~line 2936): drop the `inspection?.id` guard and render for every card using `order.id`.
- `src/components/order-detail/OrderServicesPanel.tsx` (~line 215): render whenever `order.id` exists rather than requiring `inspectionId`.
- Optional tidy: when an inspection is later created, no migration of notes is needed since reads are keyed on the order.
