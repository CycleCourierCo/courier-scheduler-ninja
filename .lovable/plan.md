

## Unit Economics Section for Route Profitability Page

### What it does
Adds a new "Unit Economics" card/section to the Route Profitability page that shows per-unit metrics (per stop, per mile, per driver, per hour) with the ability to view these across different time periods — the currently selected day, week, month, and year.

### Metrics to display
- **Revenue per Stop** — total revenue / total stops
- **Cost per Stop** — total costs / total stops
- **Profit per Stop** — profit / total stops
- **Revenue per Mile** — total revenue / total miles
- **Cost per Mile** — total costs / total miles (actual vs configured)
- **Profit per Mile** — profit / total miles
- **Revenue per Driver-Day** — total revenue / number of timeslips
- **Cost per Driver-Day** — total costs / number of timeslips
- **Profit per Driver-Day** — profit / number of timeslips
- **Revenue per Hour** — total revenue / total hours worked

### Time period tabs
A tab group letting the user switch between: **Day** (uses selected date), **Week** (uses selected week), **Month** (uses selected month), **Year** (uses selected year). Each tab computes unit economics from the already-fetched timeslip data for that period — no new queries needed.

### Changes

| File | Change |
|---|---|
| `src/services/profitabilityService.ts` | Add `calculateUnitEconomics()` function that takes timeslips array + settings and returns per-stop, per-mile, per-driver, per-hour metrics |
| `src/components/analytics/UnitEconomicsCard.tsx` | New component: tabs for Day/Week/Month/Year, grid of metric cards showing the unit economics for the selected period |
| `src/pages/RouteProfitabilityPage.tsx` | Import and render `UnitEconomicsCard` between the weekly chart and monthly chart sections, passing all timeslip datasets and settings |

### Technical details

**`calculateUnitEconomics`** reuses the existing `aggregateProfitability` results plus sums `total_hours` and `mileage` from the timeslips array to derive per-unit figures. Returns an object with all the metrics above, handling division-by-zero gracefully (returns 0).

**`UnitEconomicsCard`** uses existing `Tabs` + `Card` UI components. Each metric shown as a small stat cell in a responsive grid (3-4 columns on desktop, 2 on mobile). Color-coded: green for positive profit metrics, red for negative.

The day/week/month/year data is already fetched by the parent page (`timeslips`, `weekTimeslips`, `monthTimeslips`, `yearTimeslips`), so this component just receives them as props and computes the unit economics client-side.

