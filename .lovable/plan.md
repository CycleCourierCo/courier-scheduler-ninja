

## Plan: Fix AI Rejection, Interleave Pickups/Deliveries, Remove v1

### Problem Analysis

From the edge function logs, three distinct issues:

1. **AI IS being called but always rejected.** The AI assigns whole candidate groups (which are region-based) to day/slot. But a collection in North East and its delivery in South East are in *different groups*. The AI doesn't know about these cross-group dependencies, so it puts delivery groups on Day 1 and collection groups on Day 2 → validation catches "delivery before collection" and rejects the plan → fallback runs.

2. **Fallback produces all-pickups-first routes.** The two-pass structure (Pass 1: all collections, Pass 2: all deliveries) means within a given day, collections are loaded onto slots first, then deliveries are added separately. This creates routes that are collection-heavy early and delivery-heavy late, which is inefficient and risks exceeding van capacity.

3. **v1 still exists** — user wants it removed entirely.

### Changes

#### 1. `supabase/functions/predict-routes-v2/index.ts` — Fix AI prompt + fallback interleaving

**AI prompt fix (lines 325-346):**
- Add dependency info to the AI prompt. After building `groupSummaries`, compute a `cross_group_dependencies` list: for each order whose collection and delivery are in *different* groups, include `{ order_id, collection_group_index, delivery_group_index }`.
- Add to system prompt Rule 6: "Here are orders whose collection and delivery are in different groups. The delivery group's day MUST be >= the collection group's day. If they are on the same day, they MUST share the same driver_slot."
- Include the dependencies list in the user prompt.

**Fallback fix — interleave instead of two-pass (lines 765-948):**
- Replace the current two-pass (Pass 1: collections, Pass 2: deliveries) with a single-pass that processes stops **by group** but handles dependencies inline:
  - For each group (sorted by composite score), assign ALL stops (both collections and deliveries) together.
  - When assigning a delivery: check `collectionMap` first. If collection already assigned (from a prior group), apply the cross-region split logic. If collection NOT yet assigned (from a later group), defer this delivery to a second pass.
  - After the main loop, do a short second pass for deferred deliveries only (these are cases where the delivery's group was processed before the collection's group).
- This ensures each slot gets a mix of collections and deliveries, not all-pickups-first.

#### 2. Remove v1 entirely

**Delete:** `supabase/functions/predict-routes/index.ts` (the entire file/directory)

**`supabase/config.toml`:** Remove the `[functions.predict-routes]` section (lines 69-70).

**`src/pages/AIRouting.tsx`:**
- Remove `planningMode` state and all references to it
- Hardcode function name to `'predict-routes-v2'`
- Remove `planningMode` prop from `AIRoutingControls`
- Remove `planningMode === 'v2'` condition on `UnassignedStopsPanel` (always show it)

**`src/components/ai-routing/AIRoutingControls.tsx`:**
- Remove `planningMode` prop and `onPlanningModeChange` prop
- Remove the Planning Mode toggle group UI

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/predict-routes-v2/index.ts` | Add cross-group dependencies to AI prompt; replace two-pass fallback with interleaved assignment |
| `supabase/functions/predict-routes/index.ts` | **Delete** |
| `supabase/config.toml` | Remove `[functions.predict-routes]` entry |
| `src/pages/AIRouting.tsx` | Remove planningMode state, hardcode v2, remove v1 references |
| `src/components/ai-routing/AIRoutingControls.tsx` | Remove planning mode toggle |

