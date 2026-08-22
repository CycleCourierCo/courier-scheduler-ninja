# Dedicated Mechanic Profitability page

Pull all mechanic/workshop performance out of Route Profitability and Analytics into one dedicated page with its own menu item.

## What changes

1. **New page: Mechanic Profitability (`/mechanic-profitability`)**
   - Page shell with heading "Mechanic Profitability" and a short description.
   - Sections, in order:
     - Mechanic profitability panel (date range, per-mechanic table, totals) — moved from Route Profitability.
     - Mechanic comparison chart (revenue / profit / jobs per mechanic) — moved from Analytics.
     - Mechanic hours: hours clocked vs earned hours, hours possible and jobs available — moved from Analytics.

2. **Route Profitability page**
   - Remove the mechanic profitability panel so the page stays purely route/driver economics.

3. **Analytics page**
   - Remove the mechanic comparison chart and the whole "Mechanic Hours" block from the Inspections tab.
   - Everything else on that tab (inspection stats, inspections over time, stage durations, parts/labour averages) stays as is.

4. **Menu + access**
   - Register the new route in the central route registry under the "Insight" section (wrench icon) so it shows up automatically in the sidebar and in Admin > Route Permissions.
   - Default access: admin only, matching Route Profitability; admins can grant it to mechanics or other roles later.

## Technical notes

- New `src/pages/MechanicProfitabilityPage.tsx` reusing the existing `MechanicProfitabilityPanel`, `MechanicComparisonChart` and `MechanicHoursSection` components — no changes to their internals or to `mechanicProfitabilityService`.
- `src/App.tsx`: add the route wrapped in `ProtectedRoute adminOnly`.
- `src/config/routes.ts`: add entry `mechanic-profitability` (section "Insight", `defaultRoles: []`).
- `src/pages/RouteProfitabilityPage.tsx`: remove the `<MechanicProfitabilityPanel />` block and its import.
- `src/pages/AnalyticsPage.tsx`: remove the two component usages, their imports, and the now-empty "Mechanic Hours" heading/wrapper.
