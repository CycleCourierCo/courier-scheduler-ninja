

## Fix: Geography-Aware Route Planning with Depot-Centric Regions

### Problems

1. **AI prompt has zero geographic intelligence** — no mention of depot location, UK regions, or directional routing. The AI just sees cluster IDs and lat/lon with no context about what makes a sensible route.
2. **Fallback heuristic distributes evenly across ALL day/slot combos** — no concept of geographic density or route direction. A Manchester stop and a Dorset stop can land on the same driver slot.
3. **Clustering is a naive lat/lon grid** — doesn't respect UK geography or the depot's location in Birmingham. A grid square might span from Wales to East Anglia.
4. **AI validation is all-or-nothing** — one missing stop kills the entire AI plan, forcing the weak fallback.
5. **No target stops-per-route** — the system doesn't aim for dense routes (~11 stops/driver/day).

### Solution: 1 file changed (`supabase/functions/predict-routes/index.ts`)

#### 1. Define depot + UK geographic regions

Hardcode the depot (Birmingham B10, lat 52.469, lon -1.876) and define named regions based on postcode prefixes:

- **North West**: M, WA, WN, BL, OL, SK, CW, CH, PR, L, FY
- **North East**: LS, BD, HG, YO, HU, DN, S, HD, WF, NE, DH, SR, TS, DL
- **East**: CB, PE, NR, IP, CO
- **South East London**: E, N, SE, SW, W, NW, EC, WC, BR, CR, DA, EN, HA, IG, KT, RM, SM, TW, UB
- **South East Kent**: CT, ME, TN, SS
- **South West Coastal**: BH, SO, PO (Dorset, Southampton, Portsmouth)
- **South West Deep**: EX, PL, TQ, TR, TA, DT (Devon, Cornwall)
- **Wales**: CF, SA, LD, SY, NP, LL
- **West Midlands Local**: B, WS, WV, DY, CV, NN, DE (depot-area)

A stop's region is determined by its postcode prefix. Stops in the same region should be on the same driver slot.

#### 2. Replace grid clustering with region-based clustering

Instead of `assignClusters()` using a naive grid, assign `cluster_id` based on the region mapping above. This means the AI and fallback both group Birmingham stops together, Wales stops together, etc.

#### 3. Rewrite the AI prompt with geographic context

Update the system prompt to include:
- Depot location (Birmingham B10)
- Named regions and which postcodes belong to each
- Rule: "Each driver slot should cover ONE region or adjacent regions — never mix distant regions"
- Rule: "Target 10-14 stops per driver slot per day. Pack routes densely and minimise days used"
- Rule: "Routes radiate outward from Birmingham — a driver goes in one direction per day"

#### 4. Rewrite the fallback heuristic for density + region grouping

Replace the current even-distribution approach:
1. Group stops by region
2. For each day, fill driver slots by assigning entire region groups (or sub-groups if a region is large)
3. Target ~11 stops per slot; only move to next day when current day's slots are full
4. Respect collection-before-delivery and allowed dates
5. Within a region, sort by distance from depot (outward then return)

#### 5. Make AI validation lenient (partial accept)

If AI assigns >90% of stops correctly:
- Accept the AI assignments for those stops
- Add missing stops via the fallback heuristic (into their correct region slots)
- Only reject entirely if <75% assigned or critical constraint violations

#### 6. Fetch postcode_patterns for density hints

Query the `postcode_patterns` table and pass region-level summaries to the AI prompt, e.g. "B10 region averages 15 jobs/week, typically collected Mon/Tue". This gives the AI historical awareness.

### Expected outcome

- Routes grouped by direction from Birmingham: one driver does NW, another does SE London, another does East, etc.
- Dense routes with ~11 stops per driver per day
- Fewer days used (pack Mon/Tue before spilling to Wed)
- AI gets enough context to make sensible regional groupings
- Fallback is genuinely useful rather than spreading stops across 25 thin routes

