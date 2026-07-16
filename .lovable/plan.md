## Goal
Give mechanics read access to the Labour Times admin page, while keeping workshop settings and per-row price display admin-only.

## Changes

### 1. Route guard (`src/App.tsx`)
- Change `/admin/labour-times` route from `adminOnly={true}` to a plain `<ProtectedRoute>`.

### 2. `src/components/ProtectedRoute.tsx`
- Add `isLabourTimesPage` and allow it in the `mechanic` restricted-role branch (alongside inspections, box-my-bike, tasks, mechanic-clock, profile).

### 3. `src/pages/LabourTimesAdmin.tsx`
- Read `userProfile` via `useAuth` and compute `isAdmin = hasRole(userProfile, 'admin')`.
- If not admin:
  - Hide the Workshop Settings card entirely.
  - Hide the "Price" column in the Labour Times table (and remove it from the column-visibility toggle).
  - Hide "Add repair", row edit, and delete controls (mechanics get read-only view). Keep search, filters, pagination, and the Multipliers tab as read-only too (no add/edit/delete buttons).
- Still fetch `workshop_settings` via the existing hook so any admin-only price rendering elsewhere is unaffected; simply don't render the settings UI for mechanics.

### 4. Sidebar/menu link (`src/components/Layout.tsx`)
- Show the "Labour times" nav entry to admins **and** mechanics (currently admin-only).

## Not changing
- Database policies: existing admin-only write policies on `labour_times`, `labour_time_multipliers`, and `workshop_settings` already prevent mechanics from mutating anything, so no migration is needed. Read policies already allow authenticated users.
- Pricing formula, services layer, dialogs — untouched.
