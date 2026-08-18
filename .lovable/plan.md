# Auto-save route when sending

When timeslots are sent successfully, stop prompting for a route name. Save the route silently instead.

## Behaviour

- If the route was already loaded/saved: update it as it does today (unchanged).
- If it's a new route: create the saved route automatically, with the name built from the route date and the new route ID, e.g. `2026-08-19 — 3f2a1b9c`.
- Show a brief confirmation toast with the generated name; no dialog appears.
- The "Save Route" buttons in the toolbar still open the naming dialog for manual saves.

## Technical

In `src/components/scheduling/RouteBuilder.tsx`:
- Add a `createSavedRouteRow()` helper mirroring `updateSavedRouteRow`'s `job_data` mapping, but inserting into `saved_routes` with a generated `crypto.randomUUID()` id, `name` = `${format(selectedDate, 'yyyy-MM-dd')} — ${id.slice(0, 8)}`, `start_time`, `starting_bikes`, and `created_by` from `supabase.auth.getUser()`.
- In the SendZen send flow (around line 2974), replace the `toast.info(...)` + `setShowSaveRouteDialog(true)` branch with a call to the new helper, then set `currentRouteId` / `currentRouteName` from the result.
- Failures log and show a warning toast, without blocking the send result.
