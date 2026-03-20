# AI Route Prediction System — Full Technical Documentation

## Overview

The AI Route Prediction system generates multi-day, multi-driver route plans for Cycle Courier, a bicycle transport company operating from a depot in **Birmingham (B10 0AD)**. It uses a **4-layer hybrid pipeline** combining deterministic pre-processing, AI-assisted allocation (Google Gemini), deterministic validation with fallback heuristics, and final sequence optimisation via Geoapify.

The system is accessed at `/ai-routing` and is available to admin and route planner users only.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                          │
│  /ai-routing page — set date range, driver count, generate     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   LAYER 1    │───▶│   LAYER 2    │───▶│   LAYER 3    │      │
│  │ Deterministic│    │     AI       │    │  Validation  │      │
│  │ Pre-process  │    │  Allocation  │    │  + Fallback  │      │
│  └──────────────┘    └──────────────┘    └──────┬───────┘      │
│                                                  │              │
│                                          ┌───────▼───────┐     │
│                                          │   LAYER 4     │     │
│                                          │  Geoapify     │     │
│                                          │  Sequencing   │     │
│                                          └───────────────┘     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Supabase Tables: orders, postcode_patterns, route_predictions, │
│                   route_prediction_runs                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| Edge Function | Deno (Supabase Edge Functions) | `predict-routes` — runs the 4-layer pipeline server-side |
| AI Model | Google Gemini 2.5 Flash (via Lovable AI Gateway) | Layer 2 allocation — assigns stops to day/driver slots |
| Route Optimisation | Geoapify Route Planner API | Layer 4 — sequence optimisation and ETA calculation |
| Frontend | React + TypeScript + Tailwind CSS + shadcn/ui | `/ai-routing` page with tabs, cards, comparison views |
| Database | Supabase (PostgreSQL) | Orders, postcode patterns, prediction storage, audit logs |
| Historical Data | `build-postcode-patterns` edge function | Computes median/P90 lag, service day frequency, density per postcode |
| Authentication | Supabase Auth (admin or route_planner role required) | `requireAdminOrRoutePlannerAuth()` middleware |

---

## Layer 1: Deterministic Pre-Processing

### Order Fetching

Fetches all orders from the `orders` table **excluding** these statuses:
- `created`
- `sender_availability_pending`
- `delivered`
- `cancelled`

### Stop Expansion

Each order is expanded into up to **2 stops**: one collection and one delivery.

**Collection stop is skipped if any of these are true:**
- `collection_confirmation_sent_at` exists (confirmed collected)
- `order_collected` is true
- Status is `collected` or `driver_to_delivery`

**Delivery stop is skipped if:**
- `order_delivered` is true

**Orders are skipped entirely if:**
- Sender or receiver lacks geocoded lat/lon coordinates
- `include_no_dates` is false AND the order has no dates within the date range

### Stop Properties

Each stop gets:
- `id`: `{order_id}_collection` or `{order_id}_delivery`
- `region`: Determined by postcode prefix → region mapping (see below)
- `allowed_dates`: Customer's preferred dates filtered to the selected range, or all weekdays if flexible
- `priority`: Age of order in days (capped at 100) — older orders get higher priority
- `dependency_group`: The order ID — links collection and delivery for the same order
- `location_group`: `{contact_name_lowercase}__{postcode_prefix}` — groups different orders at the same physical location
- `date_flexible`: True if no customer dates fall within the range

### Postcode Pattern Fetching

Queries the `postcode_patterns` table for historical data (total jobs, collection/delivery day frequency per postcode prefix). This data is summarised per region and included in the AI prompt.

---

## Depot & UK Geographic Regions

### Depot Location

**Birmingham B10 0AD** — lat: 52.4690197, lon: -1.8757663

All routes are hub-and-spoke: drivers depart from Birmingham, go in ONE direction, and return.

### Region Mapping

Postcode prefixes are mapped to 10 named regions:

| Region | Postcode Prefixes | Direction from Birmingham |
|---|---|---|
| **West Midlands** | B, WS, WV, DY, CV, NN, DE | Local depot area |
| **North West** | M, WA, WN, BL, OL, SK, CW, CH, PR, L, FY, LA, CA | Manchester, Liverpool |
| **North East** | LS, BD, HG, YO, HU, DN, S, HD, WF, NE, DH, SR, TS, DL, HX | Leeds, York, Sheffield |
| **East Midlands** | NG, LE, LN | Nottingham, Leicester |
| **East** | CB, PE, NR, IP, CO, SG, AL, LU, MK, CM | Cambridge, Norwich |
| **London** | E, N, SE, SW, W, NW, EC, WC, BR, CR, DA, EN, HA, IG, KT, RM, SM, TW, UB, WD | London |
| **South East** | CT, ME, TN, SS, RH, GU, BN, SL, RG, OX, HP, MK | Kent, Sussex |
| **South West Coastal** | BH, SO, PO, SP, BA, SN | Dorset, Southampton, Portsmouth |
| **South West Deep** | EX, PL, TQ, TR, TA, DT, GL | Devon, Cornwall (long day trip) |
| **Wales** | CF, SA, LD, SY, NP, LL, HR, ST | Cardiff, Swansea |

**Region resolution**: The postcode prefix is stripped to letters only (e.g. `B10` → `B`, `CV6` → `CV`) and looked up in the map. Unrecognised prefixes default to `Unknown`.

### Allowed Region Combinations (Strict Allowlist)

Each driver slot can ONLY contain stops from **one region**, unless the combination is explicitly allowed:

| Region | May Combine With |
|---|---|
| North West | North East (if low volume) |
| North East | North West |
| London | East, South East, South West Coastal |
| East | London |
| South East | London |
| South West Coastal | London |
| **South West Deep** | **NOTHING — always isolated** |
| Wales | West Midlands |
| West Midlands | Wales, East Midlands |
| East Midlands | West Midlands |

**All other combinations are strictly forbidden.** This is enforced in:
1. The AI prompt (explicit rules)
2. The fallback heuristic (`canShareSlot()` / `canAddToSlotRegions()` helper functions)
3. The validation layer (checked as critical errors)

---

## Layer 2: AI Allocation

### When AI is Used

AI allocation runs when the `LOVABLE_API_KEY` secret is set. If missing, the system skips directly to the fallback heuristic.

### AI Gateway

- **Endpoint**: `https://ai.gateway.lovable.dev/v1/chat/completions`
- **Model**: `google/gemini-2.5-flash`
- **Auth**: Bearer token using `LOVABLE_API_KEY`

### What the AI Receives

**Stop abstractions** (trimmed for token efficiency):
- `id`, `type`, `region`, `allowed_dates` (max 5), `priority`, `dependency_group`, `location_group`, `postcode`, `lat` (3dp), `lon` (3dp)

**System prompt includes:**
- Depot location and description
- Full region → postcode mapping
- Current stop counts per region + historical job counts from `postcode_patterns`
- 12 critical rules (see below)

**Tool calling**: The AI is forced to call `suggest_route_assignments` which returns structured `{ stop_id, day, driver_slot }` assignments.

### AI Rules (from the prompt)

1. Each driver slot MUST contain stops from ONE region only, unless explicitly allowed combo
2. Allowed combos listed explicitly (NW+NE, London+East, London+SE, London+SW Coastal, Wales+WM, WM+EM)
3. South West Deep (Devon/Cornwall) MUST NEVER be combined with any other region
4. Target **10–14 stops per driver slot per day** — pack densely, minimise days
5. Fill Day 1 slots first before spilling to Day 2
6. Collection stops MUST be on the same day or BEFORE their paired delivery (same dependency_group)
7. **If collection and delivery for the same order are on the SAME day, they MUST be on the SAME driver_slot** (they CAN be on different days with different drivers)
8. Stops with the same `location_group` SHOULD be on the same driver_slot and day
9. Prefer customer's allowed_dates, but density and regional grouping take priority
10. Higher priority (older) stops should be scheduled earlier
11. Driver_slot values: 1 to N (where N = driver_count)
12. West Midlands local stops can combine with Wales or East Midlands if insufficient local volume

---

## Layer 3: Validation & Fallback

### Lenient Validation (Partial Accept)

After AI returns assignments, validation runs in two stages:

#### Coverage Check
- **≥75% coverage**: AI result is accepted (missing stops are patched via fallback)
- **<75% coverage**: Entire AI result is rejected; full fallback runs
- **≥90% coverage**: Marked as `validationPassed = true`

#### Critical Error Detection (`validateCriticalErrors`)

The following are checked and cause full rejection if found:

1. **Invalid driver slot**: Any assignment with `driver_slot < 1` or `> driver_count`
2. **Delivery before collection**: If a delivery's day is earlier than its collection's day (same `dependency_group`)
3. **Same-day split**: If collection and delivery for the same order are on the **same day** but assigned to **different driver slots** — this is physically impossible
4. **Region mixing**: For each day/slot, all regions present are checked pairwise via `canShareSlot()`. Any forbidden combination is a critical error

### When Fallback Triggers

The fallback heuristic runs in these scenarios:

1. **No LOVABLE_API_KEY** — AI is entirely skipped
2. **AI gateway returns error** (e.g. 429 rate limit, 402 credits exhausted, network failure)
3. **AI returns no assignments** (empty or unparseable response)
4. **Coverage < 75%** — AI assigned too few stops
5. **Critical errors found** — delivery before collection, same-day split across slots, forbidden region mixing

When fallback patches missing stops (coverage ≥75%, no critical errors), the patched stops are appended to the AI assignments. When fallback replaces entirely, all stops go through the heuristic.

### Fallback Heuristic: Density-First, Region-Grouped

**Target**: ~11 stops per driver slot per day

**Algorithm**:

1. **Group stops by region**, sort regions by size (largest first)
2. **Within each region**, sort: collections before deliveries, then by distance from depot (Haversine)
3. **Assign collections first**, region by region:
   - **Priority 1 — Location group**: If another stop at the same `location_group` is already assigned, use that slot (if region-compatible and capacity available)
   - **Priority 2 — Existing region slot**: If this region already has a slot on the current day with capacity, use it
   - **Priority 3 — Compatible slot**: Find first day/slot that is either empty, same-region, or region-compatible with capacity
   - **Priority 4 — Last resort compatible**: Any slot up to 1.5× target with region compatibility
   - **Priority 5 — Overflow**: Any empty slot on any day
4. **Assign deliveries** after all collections, respecting:
   - **Minimum day constraint**: Delivery day must be ≥ collection day for same order
   - **Same-day same-slot constraint**: If delivery falls on the same day as its collection, it MUST go on the collection's slot
   - Same priority cascade (location group → region slot → compatible slot → last resort)
5. **Region ownership tracking**: A `slotRegionOwner` map (key: `day_slot`, value: `Set<string>`) tracks which regions are assigned to each slot. `canAddToSlotRegions()` checks compatibility against ALL existing regions on a slot before allowing assignment.

---

## Layer 4: Sequence Optimisation (Geoapify)

After the plan is generated, individual routes can be **sequence-optimised** using the Geoapify Route Planner API. This is triggered per-route from the UI ("Optimize Sequence" button) or per-day ("Optimize All Routes").

### Technology

- **API**: Geoapify Route Planner (`https://api.geoapify.com/v1/routeplanner`)
- **API Key**: `VITE_GEOAPIFY_API_KEY` (client-side) / `GEOAPIFY_API_KEY` (server-side)
- **Mode**: `light_truck`
- **Optimisation**: `time` (minimise total travel time)

### How It Works

1. Route stops are converted to Geoapify "shipments" with pickup locations and 15-minute service duration
2. If a collection and delivery for the same order are on the same route, a `depends_on` constraint ensures collection comes first
3. Agent start/end location is the depot (Birmingham B10)
4. Response provides optimal sequence order, ETAs, and departure times
5. UI updates stops with `sequenceOrder` and `estimatedArrivalTime`
6. 3-hour timeslot windows are calculated from each ETA

---

## Data Storage & Audit Trail

### `route_predictions` Table

Stores each generated plan:
- `created_by`: User who generated the plan
- `driver_count`: Number of drivers requested
- `date_range_start` / `date_range_end`: Planning window
- `pending_job_count`: Number of orders considered
- `predicted_routes`: Full JSON of `routes_by_day` (day → slot → stops[])
- `status`: `draft` (plans are non-destructive simulations)

### `route_prediction_runs` Table

Audit log for each generation attempt:
- `prediction_id`: Links to the saved prediction
- `model_used`: `google/gemini-2.5-flash` or `fallback_heuristic_v2`
- `prompt_version`: `v2_geographic`
- `pending_jobs_hash`: SHA-256 hash (first 16 chars) of sorted stop IDs — allows detecting identical job sets
- `validation_passed`: Boolean
- `validation_errors`: Array of error strings
- `fallback_used`: Boolean
- `ai_tokens_used`: Token count from AI response

### `postcode_patterns` Table

Historical stats per postcode prefix, built by the `build-postcode-patterns` edge function:
- `postcode_prefix`: e.g. `B10`, `M1`, `CF14`
- `total_jobs`: Total historical jobs at this postcode
- `median_days_to_collection` / `median_days_to_delivery`: Median lead time
- `p90_days_to_collection` / `p90_days_to_delivery`: 90th percentile lead time
- `collection_day_frequency` / `delivery_day_frequency`: Day-of-week frequency counts
- `common_sender_receiver_pairings`: Top 10 sender→receiver postcode pairs
- Refreshed manually via "Refresh Patterns" button on the UI

---

## UI Components

### `/ai-routing` Page (`src/pages/AIRouting.tsx`)

Main orchestration page with:
- **AIRoutingControls**: Date range, driver count, include-no-dates toggle, generate/compare/refresh buttons
- **RouteComparisonView**: Side-by-side cards comparing 2+ driver scenarios (total stops, days needed, avg stops/route, validation status)
- **Day tabs**: One tab per day showing stops count
- **DayOverview**: Per-day summary bar with total stops, route count, "Optimize All" button
- **PredictedRouteCard**: Per-driver-slot card showing stops list with:
  - Region badges (e.g. "North West", "London")
  - Date match badges: Green "Available", Yellow "Not Preferred", Grey "No Dates"
  - Pickup (P) / Delivery (D) indicators
  - Sequence numbers and ETAs (after optimisation)
  - "Optimize Sequence" and "Load into Builder" buttons
- **ValidationBadge**: Top-right indicator — green "AI Validated", yellow "Fallback Used", red "Validation Failed" with error tooltip

### Scenario Comparison

Users can generate plans for different driver counts (e.g. 3 vs 4 drivers) and compare metrics:
- Total stops (should be equal)
- Days needed (fewer drivers = more days)
- Average stops per route (target ~11)
- Which method was used (AI vs fallback)

### Load into Route Builder

Each route card has a "Load into Builder" button that navigates to `/scheduling?jobs=...&date=...` with URL parameters encoding the stop list, enabling the manual scheduling workflow for final timeslot assignment and customer notification.

---

## Error Handling & Rate Limits

| Error | Behaviour |
|---|---|
| AI gateway 429 (rate limit) | Toast: "Rate limit reached. Please try again in a moment." |
| AI gateway 402 (credits exhausted) | Toast: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." |
| AI gateway other error | Logged to console, fallback heuristic runs silently |
| AI response unparseable | Logged, fallback runs |
| No geocoded addresses | Returns error: "No valid stops with geocoded addresses found" |
| No pending orders | Returns error: "No pending orders found for route prediction" |
| Missing required fields | Returns 400 with field names |
| Geoapify optimisation failure | Toast error, stops retain original order |

---

## Key Business Rules Summary

1. **Routes radiate from Birmingham** — one direction per driver per day
2. **Region exclusivity** — each slot gets one region or an allowed combo only
3. **Devon/Cornwall always isolated** — never combined with any other region
4. **Target density: 10–14 stops per slot** — pack routes, minimise days
5. **Collection before delivery** — same order's collection must be ≤ delivery day
6. **Same-day = same driver** — if collection and delivery are on the same day, they must share a driver slot
7. **Location grouping** — different orders at the same address/contact should share a route when possible
8. **Older orders prioritised** — higher priority score for orders waiting longer
9. **Customer dates preferred but not mandatory** — density and regional grouping take priority
10. **Plans are non-destructive** — they are simulations until loaded into the route builder
