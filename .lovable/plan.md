
# Replace Shipday with an in-portal dispatch system + native driver app

This is a large piece of work. Splitting it into phases so each one ships something usable and you stop depending on Shipday gradually. Nothing about your existing orders, scheduling, invoicing or messaging changes — we're adding the dispatch surface that Shipday currently owns and wiring drivers into your own portal.

You already have most of the data Shipday holds (orders, statuses, drivers, postcodes/coords, route builder, AI Routing v2, timeslips, POD-style fields). What's missing is: a unified Orders board, a lasso-on-map route planner, a live driver app, and live location/ETA tracking.

---

## Phase 1 — Orders board (Shipday "Orders" tab)

A single page that mirrors the Shipday Orders screen.

- Tabs: Current / Scheduled / Completed / Incomplete / History (driven by `orders.status` + dates).
- Columns: Order No, Customer, Pickup, Distance, Req. Pickup/Delivery Time, Driver, Status, Tracking.
- Search box (order number, name, postcode), CSV upload (reuse existing), New Order button (links to existing Create Order).
- Row click opens an order detail drawer (reuses existing `OrderDetail` content in a side sheet).
- Inline "Assign" button → driver picker modal (list from `profiles` with role `driver`, shows on-shift status from a new `driver_shifts` table).
- Bulk select + bulk assign / bulk add-to-route.

## Phase 2 — Routes page with map + lasso (Shipday "Routes" tab)

This is the centrepiece.

- Two-pane layout: left = unassigned jobs list + current routes list, right = Google Map.
- Map markers for every pickup/delivery, coloured by status, clustered when zoomed out.
- **Lasso tool** using `google.maps.drawing.DrawingManager` polygon, with point-in-polygon filtering of markers.
  - Default: lasso creates a new route draft (named "Route N").
  - Hold **Shift** (or toggle "Add to current route" in the toolbar) to add lassoed jobs into the currently-selected route instead.
  - Double-click or Esc closes the lasso (same UX as Shipday).
- Marker click → popover with "Assign driver / View details / Add to route" (Shipday parity).
- Route panel shows ordered stops, total miles, ETA, cost; drag to reorder; "Optimise" button.
- **Optimise** calls a new edge function `optimise-route` that uses **Google Routes API `computeRouteMatrix`** (already available via the Google Maps connector gateway) to build a distance/time matrix, then runs a 2-opt/nearest-neighbour solver server-side and returns ordered stop indices + total distance + total duration.
- Save route → writes to a new `dispatch_routes` table; Assign route to a driver → fans out per-stop assignments.

## Phase 3 — Drivers page + shifts

- Drivers list mirroring Shipday: avatar, name, rating, phone, email, vehicle, on/off shift.
- New table `driver_shifts` (driver_id, started_at, ended_at, last_lat, last_lng, last_seen_at).
- "Start shift / End shift" button in the driver app updates this; portal shows live status.
- Daily payment tab (reuse / extend existing timeslip system — already does most of this).

## Phase 4 — Dispatch / Live tracking page

- Map with all on-shift drivers (live markers from `driver_shifts.last_lat/lng` via Supabase Realtime).
- Active routes overlaid; click a driver to see their current sequence and ETAs.
- Per-stop status (en route / arrived / completed) shown live.
- Replaces Shipday's "Dispatch" tab.

## Phase 5 — Native driver app (Capacitor)

Same React codebase, separate `/driver` route tree, packaged with Capacitor for iOS + Android.

- Login (Supabase auth, driver role).
- Today screen: ordered stops for the assigned route, with collapsible cards.
- Per-stop actions: **Navigate** (opens Google/Apple Maps), **Arrived**, **Collected / Delivered**, **Take photo**, **Signature** (canvas), **Notes**, **Failed delivery** (reason).
- Background geolocation (`@capacitor/geolocation` + `@capacitor-community/background-geolocation`) pushes coords to `driver_shifts` every 30–60s while on shift.
- Push notifications (`@capacitor/push-notifications`) for new route assignments and edits.
- Camera (`@capacitor/camera`) for POD photos, uploaded to a new `pod` storage bucket.
- Works offline-first: queue status changes locally (IndexedDB) and sync when online.

## Phase 6 — Customer tracking page

- Public `/track/:trackingId` page (you already have one — extend it).
- Live driver location on map + estimated arrival window, populated from `driver_shifts` + the route's remaining stops.
- Replaces Shipday's customer tracking URL.

## Phase 7 — Cutover

- Add a feature flag `use_internal_dispatch` per environment.
- Run both in parallel for a week; reconcile counts daily.
- Stop calling `create-shipday-order` / `delete-shipday-order` / `shipday-webhook`.
- Keep the Shipday edge functions in the repo (disabled) for 30 days as a rollback path, then delete.

---

## Technical details

**New tables (Phase 1–4):**

- `driver_shifts` — driver_id, started_at, ended_at, last_lat, last_lng, last_seen_at, vehicle_id.
- `dispatch_routes` — id, name, route_date, driver_id (nullable), status (draft/assigned/in_progress/completed), total_distance_m, total_duration_s, created_by, created_at.
- `dispatch_route_stops` — id, route_id, order_id, leg_type ('pickup'|'delivery'), sequence, scheduled_eta, arrived_at, completed_at, status, pod_photo_url, pod_signature_url, pod_notes, failure_reason.
- `pod` storage bucket (private, signed URLs).

**RLS:** follow project standard — `EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid)...)` for admin/combined, scalar subqueries for driver-owned rows. `WITH CHECK` on all writes. Drivers see only their own shifts/routes/stops. Admin/route_planner see all.

**Edge functions (new):**

- `optimise-route` — input: stop coords + depot; uses Google Routes `computeRouteMatrix` via the Google Maps connector gateway; returns ordered indices + totals.
- `assign-route` — atomically writes `dispatch_routes` + stops, sends push notification to driver.
- `driver-location-ping` — driver-app callable, upserts `driver_shifts.last_lat/lng/last_seen_at` (rate-limited to 1 write / 20s per driver).
- `pod-upload` — signs upload URL for the `pod` bucket and links to the stop on completion.

**Reused:**

- Google Maps connector (already linked) for map JS + Routes API.
- Existing `profiles` + driver role for the drivers list.
- Existing `orders` table + status enum (no schema change to orders).
- Existing timeslip logic for driver payments.

**Lasso implementation:**

```text
Toolbar:  [Pan] [Lasso] [Add-to-current toggle]   Routes (3)
                              \____ Shift key also works
Map:
  • DrawingManager(polygon) → onPolygonComplete(poly)
  • Filter markers by google.maps.geometry.poly.containsLocation
  • If addToCurrent: append to current route's stops
    Else: create new draft route with those stops
  • Remove polygon overlay after capture
```

**Optimise (server-side, in `optimise-route`):**

```text
1. Build N×N matrix via computeRouteMatrix (chunked into 25×25 blocks per Google's limit, stitched).
2. Seed with nearest-neighbour from depot.
3. Run 2-opt improvement for up to 500 ms.
4. Return ordered indices, total_distance_m, total_duration_s.
```

**Capacitor app:**

- `appId: app.lovable.252363c3e6734761adce5be670d61f60` (existing).
- New deps for Phase 5: `@capacitor/geolocation`, `@capacitor-community/background-geolocation`, `@capacitor/push-notifications`, `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/preferences`.
- Driver-only route tree at `/driver/*` already permission-gated by existing driver role memory.

**What I will NOT change:**

- Order creation / B2B / B2C flows, invoicing, QuickBooks, SendZen/Resend messaging, availability emails, AI Routing v2, warehouse stock, fuel finder, inspections. These keep working as-is.

---

## What I need from you before starting

1. Confirm Phase 1 + 2 first (Orders board + Routes lasso). I'd ship those, get you running them daily, then move to driver-app phases.
2. Confirm you want me to keep `dispatch_routes` separate from your existing `route_builder` / AI Routing data, or merge them. (Recommendation: separate, then migrate AI Routing to write into `dispatch_routes` later.)
3. For the driver app: you'll need an Apple Developer account ($99/yr) and a Google Play Developer account ($25 one-off) to publish. We can build/test on devices without those.
