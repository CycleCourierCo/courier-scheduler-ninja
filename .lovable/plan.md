

## Root Cause: Delivery Processed Before Its Collection

The cross-region split code at line 813-851 of `predict-routes-v2/index.ts` checks `collectionMap.get(stop.dependency_group)` to find the collection's assigned day. But **groups are processed in composite score order, not collection-first order**. 

Groups are region-based (line 613-658): a South East delivery and its North East collection are in **different groups**. If the South East group has a higher composite score, it gets processed first. When the delivery stop hits line 813, `collectionMap` has no entry for that order yet because the North East group hasn't been processed. So `coll` is undefined, the cross-region check is skipped entirely, and the delivery just goes wherever the group lands.

The same bug exists in `predict-routes/index.ts` — the v1 fallback processes collections first then deliveries (correct order), but has a similar issue where `crossRegionSplit` can fail when `minDay` ends up equal to the last weekday.

### Fix

**`predict-routes-v2/index.ts` — Two-pass assignment in `archetypeAwareFallback`:**

Split the single loop (line 805-879) into two passes:
1. **Pass 1: Collections only** — iterate all groups, assign only `type === 'collection'` stops, recording them in `collectionMap`
2. **Pass 2: Deliveries only** — iterate all groups again, assign only `type === 'delivery'` stops. Now `collectionMap` is fully populated, so the cross-region check at line 822 will always find the collection and correctly bump the day

This is a minimal change — same assignment logic, just reordered so collections are always known before deliveries are processed.

**`predict-routes/index.ts` — Fix last-day edge case:**

In the v1 fallback (line 928-935), when the collection is on the last available weekday, `minDay` stays equal to the collection day, defeating the split. Fix: when `collDayIndex` is the last day, still set `minDay` to a value strictly greater than the collection day (or mark the delivery as unassignable within the date range).

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/predict-routes-v2/index.ts` | Split stop assignment loop into two passes (collections first, then deliveries) |
| `supabase/functions/predict-routes/index.ts` | Fix last-day edge case where minDay equals collection day despite cross-region split |

No frontend or database changes needed.

