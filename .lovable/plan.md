## Goal

Make the Route Builder aware of whether the current route is already saved, so:
1. Sending via SendZen persists the route (create if new, update if existing).
2. The Save button becomes an Update button once a saved route is loaded, and actually updates instead of failing on the duplicate id.

## Changes

### 1. Track the "current saved route" in `RouteBuilder.tsx`
- Add state: `currentRouteId: string | null` and `currentRouteName: string | null`.
- Set both in `handleLoadSavedRoute` (extend its signature to receive `id` and `name`).
- Set both from `SaveRouteDialog`'s `onSaved` callback after a successful save.
- Clear both in the existing "Clear route" / reset flows (whatever resets `selectedJobs` to empty — will reuse existing handlers).

### 2. `SaveRouteDialog.tsx` — support update mode
- New optional props: `existingRouteId?: string | null`, `existingRouteName?: string | null`.
- When `existingRouteId` is set:
  - Pre-fill the name field with `existingRouteName`.
  - Show the existing id (read-only) instead of generating a new one.
  - Title/button copy switches to "Update Saved Route" / "Update Route".
  - `handleSave` performs `supabase.from('saved_routes').update({ name, job_data, start_time, starting_bikes }).eq('id', existingRouteId)` instead of insert.
- Otherwise keep current insert behaviour.
- `onSaved(routeId, routeName)` fires in both paths so RouteBuilder can update its state.

### 3. `LoadRouteDialog.tsx` — pass id + name up
- Extend `onLoadRoute` signature to `(jobs, startTime, startingBikes, routeId, routeName)` and call it accordingly in `handleLoadRoute`.

### 4. SendZen "Send All" auto-save in `RouteBuilder.tsx`
Inside `sendAllTimeslotsSendZen`, after the send loop completes successfully:
- If `currentRouteId` exists: silently `update` the `saved_routes` row with the current `selectedJobs`, `startTime`, `startingBikes` (keeps saved copy fresh) and toast "Saved route updated".
- If not: open the `SaveRouteDialog` (which is already wired to save). This surfaces a naming prompt rather than saving an unnamed row. Toast: "Route sent — please name and save it".

Grouped-SendZen (`sendGroupedTimeslotsSendZen`) is per-location and doesn't represent a whole route, so it will not trigger a save — only the "Send All (SendZen)" path does. I'll confirm this matches the intent; if the user wants grouped sends to also save, we mirror the same logic there.

## Files touched

- `src/components/scheduling/RouteBuilder.tsx` — state, wiring, SendZen post-send save/update.
- `src/components/scheduling/SaveRouteDialog.tsx` — update-vs-insert mode + copy changes.
- `src/components/scheduling/LoadRouteDialog.tsx` — pass id/name to callback.

No database migrations required — `saved_routes` already has the id primary key and the update path uses it.
