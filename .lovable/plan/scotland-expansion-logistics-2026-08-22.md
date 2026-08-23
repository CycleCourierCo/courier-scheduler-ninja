# Scotland Expansion Logistics

Birmingham stays the primary depot. Scotland becomes a second site with its own bays, its own stock view, Scottish order detection, and a trunk-run planner that decides how many bikes move between the two depots and when.

## What gets added

### 1. Sites (light multi-site, not full multi-depot)
- A `sites` record for Birmingham (default) and Scotland: name, address, postcode, lat/lon, active flag.
- Storage bays gain a site, so the bay grid can be filtered/tabbed by site (Birmingham / Scotland).
- Warehouse stock and depot storage allocations record which site the bike physically sits in.
- Loading page and Warehouse Stock page get a site switcher; Birmingham is the default so nothing changes for existing users until they switch.

### 2. Scotland order classification (mirrors the Northern Ireland flow)
- Detection uses the geocoded region already captured on the address (Geoapify `properties.state`, normalised to England / Scotland / Wales / Northern Ireland by the existing `resolveRegion` helper) — the same mechanism NI uses, so no postcode list to maintain. Manual override on the order stays available for odd cases, and addresses with no geocode result simply fall through to the override.
- Optional Scotland surcharge, configurable like the NI ferry surcharge.
- New milestone statuses so tracking tells the truth: `awaiting_trunk_to_scotland`, `in_transit_to_scotland`, `at_scotland_depot`, and the reverse for southbound bikes.
- Scottish orders show a "Scotland" badge on order lists, labels, and scheduling cards.
- Clustering treats Scotland as its own region rather than "far north of depot".

### 3. Trunk Run planner (`/admin/trunk-runs`)
The core new section. A trunk run is one vehicle movement between the two depots on a date.
- Create a run: date, direction (north / south / round trip), driver, vehicle, capacity in van spaces.
- Suggested load: the system lists bikes waiting for that direction, sorted by how long they've waited and any guaranteed/promised date, and recommends a run when the waiting load approaches van capacity or a bike has waited beyond a threshold.
- Planner ticks the bikes to include; a live capacity bar uses the existing van-space weightings per bike type so overload is visible before departure.
- Manifest actions: mark loaded (frees the origin bays), mark departed, mark arrived (prompts bay allocation at the destination site).
- Printable trunk manifest, reusing the existing label/PDF helpers.

### 4. Trunk suggestion signals
A small panel on the trunk run page and on Job Scheduling showing:
- Bikes waiting northbound / southbound, with total van spaces and oldest wait in days.
- Days until the next scheduled run and whether the waiting load already exceeds one van.
- Bikes at the Scotland depot with no onward delivery date set.

### 5. Driver model per run
- Each run is either a Birmingham trunker (up and back, optionally with collections/deliveries en route) or a handover with a Scotland-based driver.
- Scotland-based drivers get the same Job Scheduling and timeslip flow, filtered to the Scotland site, so their local collections and deliveries plan from the Scotland unit instead of Birmingham.
- Route building, distance and time calculations start from the run's origin site rather than the hardcoded Birmingham depot.

### 6. Reporting
- Trunk run history: bikes moved per run, van-space utilisation, cost per bike moved (using existing timeslip mileage/hours).
- Scotland section on Analytics: Scottish order volume, average days from collection to Scotland arrival, and dwell time in Scotland bays.

## Suggested build order
1. Sites + site-aware bays and stock, with Birmingham defaulted (no visible change yet).
2. Scotland detection, statuses, badges, surcharge.
3. Trunk Run planner with manual manifest and capacity bar.
4. Suggestion signals and the manifest print.
5. Scotland-origin route planning for a dedicated driver.
6. Trunk and Scotland analytics.

## Technical notes
- New tables: `sites`, `trunk_runs`, `trunk_run_items`. `storage_bays`, `warehouse_stock` and the order storage allocation gain a `site_id` defaulting to Birmingham. All new public tables get explicit GRANTs plus RLS matching existing staff-only patterns.
- `src/constants/depot.ts` currently hardcodes a single depot and is read by `clusteringService`, `routeOptimizationService`, `LoadingUnloadingPage` and `ClusterMap`. It becomes a site lookup with Birmingham as the fallback so existing behaviour is preserved.
- Capacity uses the existing `bike_type_spaces` weightings and `workshop_settings.van_spaces_capacity`.
- Scotland statuses extend the `order_status` enum, and the tracking timeline and proactive update engine get copy for the new milestones.
- Ferry/NI logic stays untouched; Scotland is a parallel classification, not a variant of NI.
