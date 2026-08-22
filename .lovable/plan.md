# Split Mechanic Profitability into its own page

Move workshop/mechanic profitability off the Route Profitability page and give it a dedicated page with its own menu item.

## What changes

1. **New page: Mechanic Profitability (`/mechanic-profitability`)**
   - Own page shell (Layout + heading "Mechanic Profitability" with a short description).
   - Renders the existing mechanic profitability panel (date range pickers, per-mechanic table, totals) unchanged, plus the mechanic comparison chart already used elsewhere for revenue/profit comparison.

2. **Route Profitability page**
   - Remove the mechanic profitability panel and its import so the page is purely route/driver economics.

3. **Menu + access**
   - Register the route in the central route registry under the "Insight" section (icon: wrench) so it appears automatically in the admin sidebar.
   - Default access: admin only, matching Route Profitability. Admins can widen it to other roles via Admin > Route Permissions.

## Technical notes

- New file `src/pages/MechanicProfitabilityPage.tsx` reusing `MechanicProfitabilityPanel` and `MechanicComparisonChart`.
- `src/App.tsx`: add the route wrapped in `ProtectedRoute adminOnly`.
- `src/config/routes.ts`: add entry `mechanic-profitability` (section "Insight", `defaultRoles: []`), which drives the sidebar menu and the route-permissions admin UI.
- `src/pages/RouteProfitabilityPage.tsx`: delete the `<MechanicProfitabilityPanel />` block and its import; no other logic touched.
