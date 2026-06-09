## Goal
Prevent users whose only role is `b2b_customer` from accessing operational/admin pages. Users with additional roles (e.g. sales + b2b) keep access through their other role.

## Change

### `src/components/ProtectedRoute.tsx`
Add a B2B restriction block after the admin short-circuit and before the restricted-roles union logic:

- Define `b2bBlockedPaths`:
  - `/scheduling`
  - `/account-approvals`
  - `/invoices`
  - `/loading`
  - `/driver-timeslips`
  - `/ai-routing`
  - `/dispatch/orders`
  - `/dispatch/routes` (and any `/dispatch/*` path via `startsWith('/dispatch')`)
- If `hasRole(userProfile, 'b2b_customer')` AND user has no other operational role (`admin`, `route_planner`, `sales`, `driver`, `loader`, `mechanic`) AND `location.pathname` matches a blocked path → `Navigate to="/dashboard"`.

This is a router-level guard so direct URL visits are blocked. Nav links to these pages are already gated on role flags (isRoutePlanner / isSales / isDriver / isAdmin / isLoader) and not shown to pure b2b users, so no Layout changes are required.

### Out of scope
- No DB / RLS changes.
- No changes to nav menus (already correctly gated).
- No changes to pages allowing admins/other roles.
