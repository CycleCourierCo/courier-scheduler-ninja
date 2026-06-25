# Bikes In Storage Bays – Trend Over Time

Add a historical chart showing how many bikes were sitting in the storage bays (between collection and delivery) on each day/week/month, alongside the existing Storage Analytics card.

## Definition (matches existing logic)

A bike is "in storage" from its **collection timestamp** until its **delivery timestamp** (or now, if not yet delivered), but only for orders that have at least one entry in `storage_locations` — same criteria the current Storage Analytics card uses (`analyticsService.ts` `getStorageAnalytics`).

For each bucket boundary `t`:
`inStorage(t) = count of orders where collectionTime <= t AND (deliveryTime IS NULL OR deliveryTime > t) AND storage_locations is non-empty`

Per bucket we also compute:
- **In** = bikes whose collectionTime falls inside the bucket
- **Out** = bikes whose deliveryTime falls inside the bucket
- **Peak intra-bucket level** (helpful when granularity is weekly/monthly)

Timestamps reuse the existing `getCollectionTimestamp` / `getDeliveryTimestamp` resolvers (collection/delivery confirmation timestamps first, Shipday fallback) — so the trend is consistent with the rest of Performance analytics.

## UI

In `AnalyticsPage.tsx`, directly under the existing `StorageAnalyticsChart`:

- **`TimeSeriesFilters`** (date range + Daily/Weekly/Monthly toggle) — reuses the existing component.
- **`StorageLevelsChart`** (new) — composed chart:
  - Area line: bikes currently in bays at each bucket end.
  - Bars: In (green) vs Out (muted) per bucket.
- Summary row above the chart: **Currently in bays**, **Peak in range** (with date), **Avg level**, **Net change** (▲/▼ vs start of range).

## Files

- `src/services/analyticsService.ts` — add `getStorageLevelsOverTime(orders, range, granularity)` returning `{ buckets: [{ date, inStorage, in, out }], peak, peakAt, avg, currentInStorage, netChange }`. Pure client-side over already-loaded `orders`.
- `src/components/analytics/StorageLevelsChart.tsx` — new recharts ComposedChart + summary badges.
- `src/pages/AnalyticsPage.tsx` — add `storageRange` / `storageGranularity` state, render filters + new chart under `StorageAnalyticsChart`.

No backend, schema, RLS, or migration changes.
