# Show receiver approval date/time on inspection card

## What changes

In the Bicycle Inspections page, when an issue has been approved by the receiver (billing party = receiver), the badge currently only says **“Approved by receiver”** with an optional “(recorded by staff)” note. This plan adds the `receiver_approved_at` timestamp next to the badge, matching the existing “Receiver declined {date}” display.

## Technical details

- File: `src/pages/BicycleInspections.tsx`
- Update the receiver-funded repairs badge inside the issue list to render `receiver_approved_at` as a localised date/time string.
- No database changes are required; `receiver_approved_at` is already stored on `inspection_issues`.
- No plan mode edge cases or RLS/policy changes.
