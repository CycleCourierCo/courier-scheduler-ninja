## Problem

Your screenshot shows two issues on mobile (360 px):

1. **Visual overlap** — the two chart cards appear to sit too close together because `space-y-2` (8 px) is too tight when the card headers wrap. The `TimeSeriesFilters` preset buttons + date picker + granularity toggle wrap into many lines on a narrow screen, making each card very tall and pushing the next card up against it.
2. **X-axis label crowding** — weekly labels like `"23 Mar – 29 Mar"` are angled at –45° but still overlap when 12+ weeks are crammed into a 360 px width.

The Monday → Sunday week bucketing is already correct (`_startOfISOWeek` uses Monday as the anchor). No logic change needed there.

## Changes

### 1. `src/components/analytics/TimeSeriesFilters.tsx`
Collapse the six preset buttons into a `<select>` dropdown on screens < 640 px. Keep the current horizontal pill buttons on desktop. This stops the header from growing to 4–5 lines tall on mobile and removes the main cause of the cards touching/overlapping.

### 2. `src/components/analytics/OrdersCreatedChart.tsx` & `OrdersCompletedChart.tsx`
- Replace fixed `interval="preserveStartEnd"` with a computed interval: `Math.max(0, Math.floor(data.length / 6) - 1)` so Recharts skips enough labels to prevent overlap on mobile.
- Add `minTickGap={12}` to the XAxis for extra safety.

### 3. `src/pages/AnalyticsPage.tsx`
Change the chart wrapper from `space-y-2 sm:space-y-4` to `space-y-6` (gap-6) so there is always comfortable breathing room between the two tall cards, even when the headers wrap.

### 4. `src/services/analyticsService.ts`
No functional change — confirm the existing `_startOfISOWeek` already snaps to Monday and the label format `Mon – Sun` is preserved.

## Out of scope
- No backend or database changes.
- No new queries or migrations.
- No changes to other analytics tabs.