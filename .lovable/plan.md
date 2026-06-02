# Add Date Filter to Vehicles Analytics Tab

## Goal
Add a date range filter to the Vehicles tab on the Analytics page so users can control which weeks of driver timeslip data are shown.

## Changes

### 1. Backend — `src/services/vehicleAnalyticsService.ts`
- Add a `DateRange` interface (`{ start: string; end: string }`).
- Update `fetchTimeslipsForAnalytics(range?)` to accept an optional date range and apply `.gte("date", range.start)` / `.lte("date", range.end)` to the Supabase query.

### 2. UI — `src/pages/AnalyticsPage.tsx`
- Add local state for the vehicles tab date range (`vehicleDateRange`).
- Default to the last 8 weeks (Monday → Sunday) on first load.
- Add quick-filter buttons: **Last 4 weeks**, **Last 8 weeks**, **Last 12 weeks**, **All time**.
- Add two popover date pickers (Calendar inside Popover) for custom start/end dates.
- Update the `useQuery` for `vehicleTimeslips` to include the date range in its `queryKey` and pass it to `fetchTimeslipsForAnalytics`.
- Wrap the filter controls in a flex row above the stats cards in the `vehicles` tab.

### 3. Out of scope
- No changes to other analytics tabs.
- No new dependencies (reuses existing `Calendar`, `Popover`, `Button` shadcn components and `date-fns`).