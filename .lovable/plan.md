

## Final Plan: AI-Powered Route Prediction System

### What We're Building

A new `/ai-routing` page where admins and route planners can:
1. Generate multi-day route plans from pending orders using AI (Gemini 3 Flash)
2. Compare plans with different driver counts (e.g. 2 vs 3 vs 4 drivers)
3. Optimize stop sequences using the existing Geoapify Route Planner
4. Load accepted routes into the existing Job Scheduling Route Builder

### Architecture: 4-Layer Pipeline

```text
1. DETERMINISTIC PRE-PROCESSING
   Expand orders → stops, compute allowed dates,
   enforce collection-before-delivery, geo-cluster, score priority

2. AI ALLOCATION (Gemini 3 Flash via Lovable AI Gateway)
   Input: cleaned stop abstractions (not raw orders)
   Output: proposed day + driver-slot groupings

3. DETERMINISTIC VALIDATION
   Verify: collection before delivery, dates in allowed window,
   no duplicates/missing, slot counts respected
   If fails → fallback heuristic (nearest-neighbour + earliest-deadline)

4. GEOAPIFY SEQUENCE OPTIMIZATION (client-side, existing service)
   Per-route or whole-day optimization via optimizeMultiDriverRoute()
```

---

### Database: 3 New Tables (1 migration)

**`postcode_patterns`** — Historical cache rebuilt periodically
- `postcode_prefix` (text, unique) e.g. "B10", "CV6"
- `total_jobs`, `sample_size`
- `median_days_to_collection`, `median_days_to_delivery`
- `p90_days_to_collection`, `p90_days_to_delivery`
- `collection_day_frequency` (jsonb), `delivery_day_frequency` (jsonb)
- `cancel_reschedule_rate`, `avg_stop_density_nearby`
- `common_sender_receiver_pairings` (jsonb)
- `weekday_route_inclusion_rate` (jsonb)
- RLS: SELECT for admin + route_planner only

**`route_predictions`** — Stored AI plans
- `created_by`, `driver_count`, `date_range_start/end`
- `pending_job_count`, `predicted_routes` (jsonb), `optimized_routes` (jsonb)
- `status` (draft/accepted/expired)
- RLS: admin + route_planner CRUD

**`route_prediction_runs`** — Feedback/evaluation logging
- FK to `route_predictions`
- `model_used`, `prompt_version`, `pending_jobs_hash`
- `validation_passed`, `validation_errors` (jsonb), `fallback_used`
- `ai_tokens_used`, `compare_scenario_metadata` (jsonb)
- `acceptance_outcome`, `planner_overrides_count`
- Post-execution fields: `actual_miles`, `actual_duration_minutes`, `jobs_completed`, `jobs_deferred`, `failed_collections`, `failed_deliveries`
- RLS: admin INSERT/SELECT/UPDATE

---

### Edge Functions: 2 New

**`build-postcode-patterns`**
- Auth: `requireAdminOrCronAuth` (manual JWT validation inside, `verify_jwt = false` in config per project convention)
- Queries all completed orders via service role
- Computes median/P90 stats, weekday frequencies, cancel rates, density, sender-receiver pairings
- Upserts into `postcode_patterns`

**`predict-routes`**
- Auth: `requireAdminOrRoutePlannerAuth` (manual JWT validation inside, `verify_jwt = false` in config)
- **Step 1 — Pre-process**: Expand pending orders into stops, compute `allowed_dates[]` from customer availability (or mark flexible if no dates), assign `priority_score`, run k-means geo-clustering for `cluster_id`, link collection-delivery `dependency_group_id`, flag conflicts. Filter out orders in statuses `created` or `sender_availability_pending`.
- **Step 2 — AI allocate**: Send cleaned abstractions to Gemini 3 Flash. Input: `{ stops: [{id, type, cluster_id, allowed_dates, priority, dependency_group, lat, lon}], driver_slots: N, date_range }`. Structured JSON output: day + slot assignments.
- **Step 3 — Validate**: Check all rules (collection before delivery, dates in allowed window, no duplicates, slot counts). If fails → apply fallback heuristic. Log result to `route_prediction_runs`.
- **Step 4 — Return**: Validated assignments saved to `route_predictions`, returned to client.

---

### Frontend: New Page + 5 Components

**`src/pages/AIRouting.tsx`** — Main page at `/ai-routing`

**`src/components/ai-routing/AIRoutingControls.tsx`**
- Date range picker, driver count input (1-6)
- "Refresh Patterns" button, "Generate AI Plan" button
- "Compare with X drivers" for side-by-side
- Toggle: "Include jobs without customer dates"

**`src/components/ai-routing/PredictedRouteCard.tsx`**
- One route slot for one day
- Stop list with badges: green (customer date matched), yellow (not customer date), grey (dates pending)
- "Optimize Sequence" button (calls Geoapify)
- After optimization: sequence numbers, ETAs, estimated miles
- "Load into Route Builder" button → navigates to `/scheduling?jobs=...&date=...`

**`src/components/ai-routing/DayOverview.tsx`**
- All routes for selected day with summary stats
- "Optimize All Routes for This Day" button (calls `optimizeMultiDriverRoute`)

**`src/components/ai-routing/RouteComparisonView.tsx`**
- Side-by-side cards: 2-driver vs 3-driver plan
- Compare: days needed, total miles, avg jobs/route, balance

**`src/components/ai-routing/ValidationBadge.tsx`**
- Shows AI validation pass/fail and whether fallback was used

---

### Modified Files

**`src/App.tsx`** — Add `/ai-routing` route with `<ProtectedRoute>`

**`src/components/ProtectedRoute.tsx`** — Add `/ai-routing` to `route_planner` allowed pages (line 87)

**`src/components/Layout.tsx`** — Add "AI Routing" nav link for admin and route_planner roles (alongside existing "Job Scheduling" links)

**`supabase/config.toml`** — Add `[functions.build-postcode-patterns]` and `[functions.predict-routes]` with `verify_jwt = false`

---

### How It Works for the Route Planner

1. Open "AI Routing" from nav menu
2. Set date range (e.g. next Mon–Fri), enter driver count (e.g. 3)
3. Optionally click "Refresh Patterns" to rebuild historical cache
4. Click "Generate AI Plan" — loading state, then results appear as day tabs
5. Review route cards per day — each shows stops with availability badges
6. Click "Optimize Sequence" per card or "Optimize All" per day for Geoapify sequencing
7. Click "Compare with 2 drivers" to generate alternative plan side-by-side
8. Accept preferred plan → "Load into Route Builder" navigates to existing `/scheduling` page with jobs pre-populated via URL params

### Key Design Decisions
- AI assists but doesn't have final authority — deterministic validation catches bad output
- Fallback heuristic ensures the system always produces a plan even if AI fails
- No order data is modified until the planner loads into Route Builder and takes manual action
- Driver identity is NOT assigned — only numbered slots
- Reuses existing `optimizeMultiDriverRoute()` and Route Builder deep-linking

