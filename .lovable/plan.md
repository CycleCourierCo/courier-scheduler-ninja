# Allow multiple roles per user

Right now each user has exactly one role stored on `profiles.role`. The `public.user_roles` table already exists (with `unique(user_id, role)`) and `has_role()` already supports multiple rows per user — but the app's write path overwrites all roles on each change and every UI gate compares against a single string. This plan finishes the multi-role wiring end-to-end.

## What the user sees

In **User Management → Edit User**, the single "Role" dropdown is replaced by a **multi-select checkbox group** of all available roles (Admin, Route Planner, Loader, Mechanic, Driver, Sales, B2B Customer, B2C Customer). The admin can tick any combination and save. The user list shows all assigned roles as small badges instead of a single role label.

Permissions become additive: a user with both `sales` and `route_planner` can reach the union of both role's pages.

## Technical changes

### 1. Edge function `manage-user-roles`
Add a new action `setMany` that accepts `roles: UserRole[]`:
- Delete all existing rows in `user_roles` for that `user_id`.
- Bulk insert the new roles.
- Update `profiles.role` to a single "primary" role for backward compatibility — pick the highest-privilege staff role in order: `admin → route_planner → loader → mechanic → sales → driver → b2b_customer → b2c_customer`.

Keep the existing `set` (single-role) action for now so nothing else breaks.

### 2. `src/contexts/AuthContext.tsx`
After loading the profile, also fetch `user_roles` for that user and expose a new field `roles: UserRole[]`. Keep `userProfile.role` (primary) for back-compat. Refresh both on auth state change.

### 3. Role gates — switch from equality to `.includes()`
- `src/components/ProtectedRoute.tsx`: every `userProfile?.role === 'X'` check becomes `roles.includes('X')`. For route-restricted roles (route_planner, sales, driver), use "allow if **any** of their allowed pages match" instead of returning early — so a user with multiple restricted roles gets the union of allowed pages. `admin` short-circuits as before.
- `src/components/Layout.tsx`: `isAdmin`, `isLoader`, `isRoutePlanner`, `isSales`, `isB2B`, `isDriver`, `isMechanic` flags switch to `roles.includes(...)`. Nav sections render based on whichever flags are true — naturally additive.

### 4. `src/pages/UserManagement.tsx`
- Replace the single-role `<Select>` in the Edit dialog with a checkbox list bound to a `selectedRoles: UserRole[]` state.
- On save, call `manage-user-roles` with `action: 'setMany'`.
- In the user table, render assigned roles as a list of small `Badge`s (fetch `user_roles` joined to profiles, or a second query keyed by user id).
- Keep the "create user" flow as-is (single initial role); they can add more after creation.

### 5. `src/types/user.ts`
Add `roles?: UserRole[]` to the user/profile type used by the UI.

## Out of scope

- No DB schema changes — `user_roles` and `has_role()` already support multiple roles.
- No changes to RLS policies (they already call `has_role(uid, 'X')`, which checks `user_roles` and naturally honors multiple roles).
- No change to customer registration flow (new B2B/B2C users still get a single role on signup).
- No bulk role editor on the list page — edits happen per-user in the existing dialog.
