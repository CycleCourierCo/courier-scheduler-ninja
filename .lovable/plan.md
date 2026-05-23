# Fix missing pins and map selection on Dispatch Routes

## What I’ll change
1. Update the pin extraction logic to read coordinates from the real order shape used in this app (`sender.address.lat/lon` and `receiver.address.lat/lon`).
2. Add a visible empty-state/debug state in the sidebar so the page shows whether there are matching scheduled orders but no coordinates, instead of silently showing `0 unassigned` with no explanation.
3. Replace the current shift-drag map event handling with a more reliable supported selection flow so box selection works consistently on the Google Maps canvas.
4. Verify that pins render for the selected date and that selection updates the sidebar count.

## Expected outcome
- Scheduled jobs with saved coordinates appear as pins.
- If a job has no coordinates, the UI makes that clear.
- Box/lasso selection works again and updates the selected stop list.

## Technical details
- Patch `src/pages/DispatchRoutesPage.tsx` only.
- Keep optimise/save route behavior unchanged.
- No database changes needed.