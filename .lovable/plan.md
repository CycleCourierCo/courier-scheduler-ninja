

## Remove postcode from "Start from Depot" label

### Current state
- Non-auth users **cannot** access Fuel Finder — it's wrapped in `<ProtectedRoute>` in App.tsx, which redirects unauthenticated users to `/auth`.
- The radio label on line 558 reads: `Start from Depot (B10 0AD)`

### Change
**File: `src/pages/FuelFinderPage.tsx`** (line 558)
- Change the label from `Start from Depot (B10 0AD)` to `Start from Depot`

One line change, no other files affected.

