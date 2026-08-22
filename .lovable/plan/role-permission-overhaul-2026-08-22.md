# Role permission overhaul

## What changes

**B2C customers — no access**
A logged-in user whose only role is `b2c_customer` is blocked from every internal route. They land on a simple "no access" screen (Access unavailable — contact us) with a sign-out button. Public pages are unaffected: tracking, sender/receiver availability, repair offer, marketing/legal pages all still work without login.

**Route planner** — gains `/trunk-runs`.

**Sales**
- Loses `/driver-timeslips`, `/invoices`, `/users`, `/account-approvals`.
- Gains `/notices` (notice bar management).
- Keeps dashboard, profile, emails, tasks, knowledge.

**Customer service (cs_agent)** — gains `/claims`, `/claims/new`, `/claims/:id`.

**New role: Fleet Manager** — access to `/vehicles` (plus profile, tasks, knowledge).

**New role: Tech** — access to `/api-keys` and `/webhooks` (plus profile, tasks, knowledge).

Admin keeps full access to everything, unchanged.

## Resulting access map

| Role | Pages |
|---|---|
| Route planner | scheduling, ai-routing, trunk-runs, dashboard, order details, tasks, knowledge |
| Sales | account approvals removed; dashboard, profile, emails, notices, tasks, knowledge |
| Loader | loading, box-my-bike, tasks, knowledge |
| Mechanic | inspections, mechanic clock, labour times, box-my-bike, profile, tasks, knowledge |
| Driver | driver timeslips, fuel finder, profile, tasks, knowledge |
| Timeslip admin | driver timeslips, profile, tasks, knowledge |
| CS agent | inbox, claims, dashboard, order details, profile, tasks, knowledge |
| Fleet manager | vehicles, profile, tasks, knowledge |
| Tech | api keys, webhooks, profile, tasks, knowledge |
| B2C customer | none |

## Technical notes

1. **Migration**: add `fleet_manager` and `tech` values to the `user_role` enum.
2. **`src/types/user.ts`**: extend the `UserRole` union with the two new roles.
3. **`src/lib/roles.ts`**: add both to `ALL_ROLES` so they're assignable in user management.
4. **`supabase/functions/manage-user-roles/index.ts`**: add the new roles to `ROLE_PRIORITY` (admin-only assignable; sales can no longer manage users anyway since `/users` is removed from sales — the function's sales branch stays for safety).
5. **`src/components/ProtectedRoute.tsx`**:
   - Early check: if the user's only role is `b2c_customer`, render the no-access screen for every route (public availability/repair paths keep their existing bypass).
   - Add `fleet_manager`, `tech` to `restrictedRoles` with their page allow-lists and fallback landing pages (`/vehicles`, `/api-keys`).
   - Update the `route_planner`, `sales`, `cs_agent` allow-lists per the table above.
6. **`src/components/Layout.tsx`**: role-specific menus for fleet manager and tech; drop invoices/users/approvals/timeslips from the sales menu and add notices; add trunk runs to the planner menu; add claims to the CS menu. Admin grouped menu untouched.
7. **`src/pages/NoticeBarManagement.tsx`** and other admin-gated pages reached by these roles: any in-page `isAdmin` gating that would blank the page for the newly allowed role is relaxed to the role check (notices for sales, vehicles for fleet manager, api keys/webhooks for tech, claims for cs_agent).
8. **RLS**: check policies on `vehicles`, `api_keys`, `webhook_configurations`, `notice_bars`, `claims` and extend them so the newly permitted roles can actually read/write, using `has_role(auth.uid(), ...)` in the same style as existing policies.

## Admin: Route Permissions manager

A new admin-only page `/admin/route-permissions` where an admin ticks which roles can reach which page, instead of permissions being hardcoded.

- Grid: one row per app page (label + path, grouped by section like the admin menu), one column per role (admin column locked on — admin always has everything).
- Toggle a checkbox to grant/revoke; Save writes the changes. A "Reset to defaults" button restores the built-in matrix above.
- The nav menu for each role is driven by the same matrix, so granting a page also makes it appear in that user's menu.

### Technical notes

9. **Migration**: new table `role_route_permissions` (`id`, `role user_role`, `route_key text`, `allowed boolean`, timestamps, unique on `role + route_key`), with GRANTs (`select` to `authenticated`, all to `service_role`), RLS on: all internal staff can read, only admins can insert/update/delete. Seeded from the default matrix above.
10. **`src/config/routes.ts`** (new): single registry of app pages — `key`, `path`, `label`, `section`, `icon`, plus `matches(pathname)` for dynamic segments (`/orders/:id`, `/claims/:id`, `/tasks/*`, `/knowledge/*`) and the default allowed roles per page. Used by the permissions page, `ProtectedRoute` and `Layout` so there is one source of truth.
11. **`src/hooks/useRoutePermissions.ts`** (new): loads the matrix once (React Query, cached) and exposes `canAccess(pathname)` and `allowedPagesForUser()`. Falls back to the defaults in the registry if the table can't be read.
12. **`ProtectedRoute.tsx`**: after the admin short-circuit and the B2C block, resolve the current pathname to a route key and allow it when any of the user's roles is granted; otherwise redirect to that user's first allowed page. Public-page bypasses stay as they are.
13. **`Layout.tsx`**: non-admin menus render from `allowedPagesForUser()`; admin keeps the full grouped menu.
14. **`src/pages/RoutePermissions.tsx`** (new) + route registration in `App.tsx` with `adminOnly`, and a link in the admin menu's Admin section.
