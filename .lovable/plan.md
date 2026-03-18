

## Phase 1: Historical Route Ingestion + Archetypes + Scoring Utilities

This phase builds the data foundation. No changes to the existing predict-routes or AI routing UI — just new tables, two new edge functions, and shared scoring code.

---

### 1. Database Migration — 4 New Tables

**`historical_routes`** — one row per driver-day route extracted from delivered orders:
- `id` uuid PK
- `route_date` date NOT NULL
- `driver_name` text NOT NULL
- `stop_count` integer NOT NULL
- `regions` text[] NOT NULL
- `centroid_lat` double precision
- `centroid_lon` double precision
- `spread_km` numeric — max pairwise haversine distance between stops
- `corridor_bearing` numeric — average bearing from depot to stops (degrees)
- `postcode_prefixes` text[] — distinct prefixes on this route
- `total_distance_km` numeric — sum of sequential haversine distances
- `stops` jsonb NOT NULL — array of {order_id, type, lat, lon, postcode_prefix, region, sequence}
- `created_at` timestamptz DEFAULT now()

**`historical_route_stops`** — denormalized for querying individual stops:
- `id` uuid PK
- `historical_route_id` uuid FK → historical_routes
- `order_id` uuid NOT NULL
- `type` text NOT NULL (collection/delivery)
- `lat` double precision
- `lon` double precision
- `postcode_prefix` text
- `region` text
- `sequence_order` integer
- `created_at` timestamptz DEFAULT now()

**`route_archetypes`** — clustered route patterns:
- `id` uuid PK
- `label` text NOT NULL — human-readable (e.g. "NW-Manchester-Corridor")
- `regions` text[] NOT NULL
- `centroid_lat` double precision
- `centroid_lon` double precision
- `avg_spread_km` numeric
- `avg_stop_count` numeric
- `corridor_bearing` numeric
- `postcode_prefixes` text[] — union of member prefixes
- `member_count` integer DEFAULT 0
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()

**`route_archetype_members`** — links routes to archetypes:
- `id` uuid PK
- `archetype_id` uuid FK → route_archetypes
- `historical_route_id` uuid FK → historical_routes
- `similarity_score` numeric — how well this route matches its archetype
- `created_at` timestamptz DEFAULT now()

RLS: All four tables admin + route_planner SELECT; admin-only INSERT/UPDATE/DELETE. Same CTE pattern as existing tables.

---

### 2. Edge Function: `build-historical-routes`

Auth: `requireAdminOrCronAuth` (same as build-postcode-patterns).

Logic:
1. Fetch all delivered orders with geocoded lat/lon, `scheduled_pickup_date`, `scheduled_delivery_date`, `collection_driver_name`, `delivery_driver_name`
2. Group into route-days:
   - Collection routes: group by `(scheduled_pickup_date::date, collection_driver_name)` where both are non-null
   - Delivery routes: group by `(scheduled_delivery_date::date, delivery_driver_name)` where both are non-null
3. For each group, compute:
   - `centroid_lat/lon` — average of all stop coordinates
   - `spread_km` — max haversine between any two stops
   - `corridor_bearing` — average bearing from depot (B10) to each stop
   - `postcode_prefixes` — distinct prefixes
   - `regions` — distinct regions (using same REGION_MAP logic)
   - `stops` jsonb — ordered by timestamp or sequence
4. Upsert into `historical_routes` (keyed on route_date + driver_name + type)
5. Insert denormalized rows into `historical_route_stops`
6. Return count of routes created

---

### 3. Edge Function: `build-route-archetypes`

Auth: `requireAdminOrCronAuth`.

Logic — simple hierarchical clustering without ML libraries:
1. Fetch all `historical_routes`
2. For each route, create a feature vector: `{primary_region, corridor_bearing, centroid_lat, centroid_lon, avg_postcode_prefixes}`
3. Cluster using a greedy merge approach:
   - Sort routes by primary region, then corridor bearing
   - For each route, find existing archetype where: region overlap ≥ 50%, centroid distance < 30km, bearing difference < 45°
   - If match found, add as member. If not, create new archetype.
4. For each archetype, compute aggregate stats (avg spread, avg stop count, union of prefixes)
5. Generate human-readable labels: `"{PrimaryRegion}-{DominantPostcode}-Corridor"` (e.g. "NW-M-Corridor", "London-SE-Corridor")
6. Truncate and re-insert `route_archetypes` and `route_archetype_members`
7. Return archetype count + member distribution

---

### 4. Shared Scoring Utilities

These will live inside the `build-route-archetypes` edge function for now, and will be copied/imported into `predict-routes-v2` in Phase 2.

**`computeCorridorBearing(stops, depot)`** — returns degrees (0-360) of average bearing from depot to stop centroid.

**`computeCompactness(stops)`** — returns `{ spreadKm, maxPairwiseKm, stopsPerKmRadius }`. Used for hard-reject validation in Phase 2.

**`bearingsCompatible(a, b)`** — returns false if bearings are >120° apart (opposite directions from depot).

**`scoreStopGroupAgainstArchetype(stops, archetype)`** — returns 0-1 similarity:
- Region overlap: 40% weight (Jaccard similarity of region sets)
- Centroid proximity: 25% weight (inverse of haversine distance, capped at 50km)
- Postcode prefix overlap: 20% weight (Jaccard similarity)
- Stop count similarity: 15% weight (1 - |diff| / max)

---

### 5. Config & Deployment

- Add both functions to `supabase/config.toml` with `verify_jwt = false` (auth handled in code)
- No frontend changes in Phase 1
- No changes to existing `predict-routes` function

---

### Summary of Deliverables

| Deliverable | Type |
|---|---|
| Migration: 4 tables + RLS + indexes | SQL migration |
| `build-historical-routes` edge function | New file |
| `build-route-archetypes` edge function | New file |
| Scoring/geo utility functions | Embedded in edge functions |
| config.toml updates | Config |

