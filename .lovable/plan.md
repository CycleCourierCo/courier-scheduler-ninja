# Verify bike brand, model and size on inspection

Add an identity check to the top of the PDI inspection sheet so the mechanic confirms the bike in front of them matches what was booked.

## Behaviour

- New "Bike identity" block at the top of the inspection dialog (above the bike category picker) showing the booked details from the order: brand and model. Frame size is shown when the booking has one; bookings currently don't capture a size, so in most cases it shows "not supplied".
- One tap: **Matches booking** or **Doesn't match**.
  - Matches — the mechanic still types the frame size found on the bike (marked size or measured), since it isn't on the booking.
  - Doesn't match — three fields appear (actual brand, actual model, actual frame size), pre-filled with the booked values so only the wrong one needs changing, plus an optional note.
- Confirm stays disabled until the identity check is answered (and, when marked as not matching, until at least one actual value differs from the booking).
- On confirm:
  - The result is written into the inspection notes/PDI summary, e.g. `IDENTITY  Booked: Trek Marlin 7 / size — · Found: Trek Marlin 5 / 17"`, so it appears on the inspection report.
  - A mismatch is stored on the inspection record and surfaced as a red **Details mismatch** badge on the inspection card and on the order's inspection panel, with the booked vs found values, for an admin to review. The order's own brand/model are left untouched.
  - Admins get a "Reviewed" action on the badge that clears the flag once they've dealt with it (leaving the note in the report).
- No mismatch simply records the confirmation and the captured frame size.

## Technical notes

Database (`bicycle_inspections`) — new nullable columns:

- `identity_checked_at`, `identity_matches` (boolean)
- `actual_bike_brand`, `actual_bike_model`, `actual_frame_size` (text)
- `identity_notes` (text)
- `identity_reviewed_at`, `identity_reviewed_by_id`, `identity_reviewed_by_name`

Existing RLS on the table already covers these columns; no new policies needed. Frontend:

- `src/pages/BicycleInspections.tsx` — new `identityResult` / actual-value state in the checklist dialog, an `INSPECTION_IDENTITY` block rendered before the category picker, added to the `allItemsChecked` gate, and an identity line prepended in `buildPdiNotes()`. Mismatch badge on inspection cards plus an admin "Mark reviewed" mutation.
- `src/services/inspectionService.ts` — persist the identity fields in `markInspected` / the multi-issue submit path, and add a `reviewInspectionIdentity` helper.
- `src/types/inspection.ts` — extend `BicycleInspection` with the new fields.
- Inspection report generator (`inspectionReport.ts`) — include the identity line in the PDF alongside the PDI checklist.
