

## Phase 2: predict-routes-v2 + UI Transparency

### Overview
Build a new `predict-routes-v2` edge function that groups stops into candidate clusters scored against historical archetypes before sending to AI, plus frontend updates for v1/v2 toggle and transparency panels.

---

### 1. Database Migration

**Alter `route_predictions`** — add 4 columns:
- `ai_proposed_routes jsonb DEFAULT NULL`
- `validated_routes jsonb DEFAULT NULL`
- `planning_mode text DEFAULT 'v1'`
- `unassigned_stops jsonb DEFAULT '[]'`

**New table: `route_group_scores`** — audit trail of candidate group scoring:
- `id` uuid PK, `prediction_id` uuid, `group_label` text, `archetype_id` uuid nullable, `similarity_score` numeric, `compactness_score` numeric, `corridor_fit` numeric, `fill_efficiency` numeric, `selected` boolean DEFAULT false, `created_at` timestamptz DEFAULT now()
- RLS: admin + route_planner SELECT; admin INSERT/UPDATE/DELETE (CTE pattern)

**New table: `planner_route_overrides`** — captures manual adjustments:
- `id` uuid PK, `prediction_id` uuid, `order_id` uuid, `action` text, `from_day` text, `from_slot` integer, `to_day` text, `to_slot` integer, `reason` text, `created_by` uuid, `created_at` timestamptz DEFAULT now()
- RLS: admin + route_planner SELECT/INSERT; admin UPDATE/DELETE (CTE pattern)

---

### 2. Edge Function: `predict-routes-v2` (~800 lines)

Same auth (`requireAdminOrRoutePlannerAuth`), same request shape as v1.

**Pipeline:**

1. **Layer 1 (identical to v1):** Fetch pending orders, expand into `Stop[]` with lat/lon/region/dates/priority/dependency_group/location_group. Reuse all helper functions from v1.

2. **Fetch archetypes:** Load all `route_archetypes` with stats.

3. **Build candidate groups:** Group stops by region, then subdivide large region groups (>14 stops) by corridor bearing in 45° buckets. Each group gets: label, regions, centroid, corridor bearing, postcode prefixes, compactness metrics, top-3 archetype matches with similarity scores, stop count.

4. **Hard-reject invalid groups:** Reject candidates where `maxPairwiseKm > 150` or bearings >120° apart within the group.

5. **Score candidate groups:** Composite score per group:
   - Archetype similarity: 35%
   - Compactness (inverse spread): 25%
   - Corridor fit (bearing alignment): 20%
   - Fill efficiency (closeness to 11 stops): 10%
   - Priority density: 10%

6. **Send candidate groups to Gemini** (not raw stops). Prompt provides scored candidate group summaries with region, stop count, archetype match, and composite score. AI selects groups and assigns to day/slot. AI can merge compatible adjacent groups but cannot split or invent new ones. Uses tool calling for structured output.

7. **Validate AI response:** Same critical error checks as v1 (collection-before-delivery, region compatibility, slot bounds) plus compactness check per assigned slot (max pairwise < 200km) and bearing compatibility. Falls back to archetype-aware fallback if validation fails.

8. **Archetype-aware fallback:** Sort candidate groups by score descending, greedily assign to day/slot respecting region rules and capacity. Stops in groups with <0.3 archetype similarity go to `unassigned_stops`.

9. **Store results:** Save `ai_proposed_routes`, `validated_routes`, and final `predicted_routes` as separate fields. Save `unassigned_stops` as jsonb. Store group scores in `route_group_scores`. Planning mode = 'v2'.

10. **Response:** Same shape as v1 plus `unassigned_stops[]`, `planning_mode: 'v2'`, and per-route metadata: `archetype_label`, `similarity_score`, `compactness_score`.

Config: Add `predict-routes-v2` to `supabase/config.toml` with `verify_jwt = false`.

---

### 3. Frontend Changes

**`AIRoutingControls.tsx`** — Add planning mode toggle (v1/v2) as a segmented control using existing Tabs component. New props: `planningMode`, `onPlanningModeChange`.

**`AIRouting.tsx`** — Add `planningMode` state, `unassignedStops` state. Call `predict-routes` or `predict-routes-v2` based on mode. Pass archetype metadata to route cards. Add "Build Historical Data" button that calls both Phase 1 functions in sequence.

**`PredictedRouteCard.tsx`** — Add optional props: `archetypeLabel`, `similarityScore`, `compactnessScore`. Show archetype as a badge and similarity as a small percentage indicator beneath the card title.

**New: `UnassignedStopsPanel.tsx`** — Collapsible panel listing stops that couldn't fit any archetype. Shows postcode, region, contact name. Displayed below day tabs when v2 is active and unassigned stops exist.

**New: `RouteWhyPanel.tsx`** — Collapsible panel per route card (toggled by an "info" icon) showing: matched archetype name, similarity breakdown (region overlap, centroid distance, postcode overlap), compactness metrics.

---

### Files Summary

| File | Action |
|---|---|
| SQL migration (2 tables + alter route_predictions) | New |
| `supabase/functions/predict-routes-v2/index.ts` | New |
| `supabase/config.toml` | Update |
| `src/components/ai-routing/AIRoutingControls.tsx` | Update |
| `src/pages/AIRouting.tsx` | Update |
| `src/components/ai-routing/PredictedRouteCard.tsx` | Update |
| `src/components/ai-routing/UnassignedStopsPanel.tsx` | New |
| `src/components/ai-routing/RouteWhyPanel.tsx` | New |
| `src/integrations/supabase/types.ts` | Auto-updated |

