# Route generator: start with no days picked

When the Generate Routes popup opens, no days are ticked. You choose the days yourself (calendar or the quick picks like "Next 3 working days"). Generate still says "Pick at least one day to plan" if none are chosen.

- The vans grid appears once you pick days, with vans ticked as before (remembered unavailable vans and vans with locked routes still start unticked).
- Nothing else changes.

## Technical detail
In `GenerateRoutesDialog.tsx` open effect: stop setting `dates` to `nextWorkingDays(days, 5)`; start with `[]`. Load vans/working days only; van unavailability and locked routes are already fetched when dates change via the existing date-change handler (verify it rebuilds the grid; if not, fetch them there for the newly picked dates).
