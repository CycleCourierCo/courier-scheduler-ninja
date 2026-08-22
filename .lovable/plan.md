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
