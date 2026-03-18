

## Plan: Create Full AI Route Prediction Documentation

### What
Create `docs/AI_ROUTE_PREDICTION.md` — a comprehensive technical document covering the entire AI route prediction system.

### Content Structure

The document will cover all of the following in detail:

**1. Overview** — 4-layer hybrid pipeline summary, depot-centric model

**2. Architecture Diagram** — ASCII flow: UI → Layer 1 (Pre-processing) → Layer 2 (AI) → Layer 3 (Validation/Fallback) → Layer 4 (Geoapify Sequencing)

**3. Technology Stack Table**
- Edge Function: Deno (Supabase Edge Functions) — `predict-routes`
- AI Model: Google Gemini 2.5 Flash via Lovable AI Gateway
- Route Optimisation: Geoapify Route Planner API
- Frontend: React + TypeScript + Tailwind + shadcn/ui
- Database: Supabase PostgreSQL
- Historical Data: `build-postcode-patterns` edge function
- Auth: Admin or route_planner role via `requireAdminOrRoutePlannerAuth()`

**4. Layer 1: Deterministic Pre-Processing**
- Order fetching (excluded statuses: created, sender_availability_pending, delivered, cancelled)
- Stop expansion logic (when collections/deliveries are skipped)
- `isCollected` check: only skips if `collection_confirmation_sent_at` exists, `order_collected` is true, or status is `collected`/`driver_to_delivery`
- Stop properties: id, region, allowed_dates, priority (order age), dependency_group, location_group, date_flexible
- Postcode pattern fetching from `postcode_patterns` table

**5. Depot & UK Geographic Regions**
- Depot: Birmingham B10 0AD (52.469, -1.876)
- Full region map table (10 regions with all postcode prefixes)
- Region resolution: strip to letters, lookup in REGION_MAP
- **Allowed region combinations** — strict allowlist table:
  - NW + NE, London + East/SE/SW Coastal, Wales + WM, WM + EM
  - South West Deep: NEVER combined with anything
  - All other combos FORBIDDEN
- Enforcement points: AI prompt, fallback heuristic (`canShareSlot`/`canAddToSlotRegions`), validation

**6. Layer 2: AI Allocation**
- When AI runs (requires LOVABLE_API_KEY)
- Gateway endpoint, model, auth
- Stop abstractions sent to AI (trimmed lat/lon, max 5 dates)
- System prompt contents: depot, regions, stop counts, historical data, all 12 rules
- Tool calling: `suggest_route_assignments` with structured schema
- Full list of 12 AI rules including same-day same-slot constraint and location grouping

**7. Layer 3: Validation & Fallback**
- Lenient validation: ≥75% accept + patch, <75% full reject, ≥90% marked validated
- Critical error checks: invalid slots, delivery before collection, same-day different-slot, forbidden region mixing
- **When fallback triggers**: no API key, gateway error, empty response, low coverage, critical errors
- **Fallback algorithm detail**:
  - Group by region, sort largest first
  - Within region: collections before deliveries, sort by distance from depot
  - Collections assigned first with 5-priority cascade (location group → region slot → compatible slot → last resort → overflow)
  - Deliveries assigned respecting min-day constraint and same-day same-slot rule
  - `slotRegionOwner` map tracks region ownership per day/slot
  - Target: ~11 stops per slot

**8. Layer 4: Geoapify Sequence Optimisation**
- Triggered per-route or per-day from UI
- Geoapify Route Planner API, mode: light_truck, optimisation: time
- Shipments with 15-min service duration
- `depends_on` constraint for same-route collection→delivery
- Returns sequence order, ETAs, 3-hour timeslot windows

**9. Data Storage & Audit Trail**
- `route_predictions` table: plan JSON, status, metadata
- `route_prediction_runs` table: model used, prompt version, jobs hash, validation status, token usage
- `postcode_patterns` table: historical stats per prefix (median/P90 lag, day frequency, pairings)

**10. UI Components**
- AIRoutingControls, RouteComparisonView, DayOverview, PredictedRouteCard, ValidationBadge
- Scenario comparison workflow
- "Load into Route Builder" deep-link to `/scheduling`

**11. Error Handling & Rate Limits**
- 429, 402, gateway errors, no geocodes, no orders, Geoapify failures

**12. Key Business Rules Summary** — 10 numbered rules covering all constraints

### File Changed
- `docs/AI_ROUTE_PREDICTION.md` — new file (~400 lines)

