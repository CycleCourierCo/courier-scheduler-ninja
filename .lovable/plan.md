# Plan

## What I’ll change

1. **Show stop dots for saved routes on the map**
   - Render markers for stops that already belong to saved routes, not just unassigned jobs.
   - Keep these visually distinct from the selectable unassigned job pins so the map shows both clearly.
   - Make sure saved-route markers stay in sync with the sidebar route list and hide/show state.

2. **Make route order deterministic and efficient**
   - Ensure the displayed stop order comes from the optimised sequence, starting from the depot at **B10 0AD**.
   - Review the current optimisation response and how sequences are persisted when creating a route.
   - When stops are appended to an existing route, re-optimise the combined route instead of simply tacking them onto the end, so the final order is efficient rather than random.

3. **Align map visuals with the saved route order**
   - Draw route lines using the same persisted sequence used in the sidebar.
   - Include depot → stops → depot consistently in both the displayed order and the map polyline.
   - Update map bounds so all visible route markers and lines fit correctly.

4. **Validate the dispatch workflow**
   - Verify that unassigned jobs still appear as selectable pins.
   - Verify that saved routes show their stop dots and line paths.
   - Verify that creating or updating a route produces a sensible ordered stop list instead of a random one.

## Technical details

- Update `src/pages/DispatchRoutesPage.tsx` to manage **two marker layers**:
  - unassigned/selectable job markers
  - saved-route stop markers
- Rework the saved-route rendering so each route uses its persisted `sequence` for:
  - sidebar order
  - route polyline path
  - visible stop markers
- Adjust the “Add to route” flow so it re-fetches the full route stop set, sends the combined stops to `optimise-route`, and writes back a newly optimised sequence instead of appending raw order.
- Keep the existing `optimise-route` Edge Function as the optimisation engine, using the depot as the route origin.
- Validate via preview/debug signals that markers are present and the ordering is no longer arbitrary.