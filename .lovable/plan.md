# Fix the blank map on Dispatch Routes

## What I’ll change
1. Replace the current lasso implementation that depends on the deprecated Google Drawing library.
2. Rework the map bootstrapping so the map initializes with supported Maps JS APIs only.
3. Add a safer fallback/error state so the page shows a clear message if Google Maps loads but the map instance still fails to render.
4. Re-test `/dispatch/routes` in preview and confirm the map panel renders and pins appear.

## Expected outcome
- The map panel on `/dispatch/routes` renders instead of staying blank.
- Stop pins appear for the selected date.
- Multi-select still works without relying on the deprecated DrawingManager.

## Technical details
- Update `src/hooks/useGoogleMaps.ts` to stop requesting the deprecated `drawing` library unless strictly needed.
- Update `src/pages/DispatchRoutesPage.tsx` to remove `google.maps.drawing.DrawingManager` usage and replace polygon/lasso selection with a supported interaction approach.
- Keep the existing optimise/save route flow unchanged.
- Validate the fix against the live preview after implementation.