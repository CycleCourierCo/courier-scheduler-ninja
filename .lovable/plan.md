# Build My Bike

A new service that turns components held in warehouse stock into a finished bike, tracked through build stages, invoiced via QuickBooks, and then returned to warehouse stock as a bike.

## 1. Components in warehouse stock

Warehouse stock gains the concept of an item kind:

- **Bike** — behaves exactly as today.
- **Component** — a part held for a customer, with a component category and a quantity.

Component categories (the full parts list needed to build a bike):

```text
Frame            Fork              Headset          Stem
Handlebar        Grips/Bar tape    Saddle           Seatpost
Seat clamp       Wheelset          Front wheel      Rear wheel
Tyres            Tubes/Sealant     Cassette         Chain
Crankset         Bottom bracket    Front derailleur Rear derailleur
Shifters         Brakes (calipers) Brake levers     Rotors
Brake pads       Pedals            Chainrings       Bearings
Cables/Hoses     Motor             Battery          Display/Controller
Rack             Mudguards         Bottle cage      Kickstand
Bell             Lights            Computer/Sensor  Accessories
Other
```

The stock table and the "Add stock" dialog get a kind toggle. Choosing Component swaps the bike fields for: component category, brand, model, spec/size, quantity, value, SKU, notes, plus the existing bay/position/site. Components appear in the stock list with a distinct badge, are filterable by kind and category, and show in the customer's My Stock page.

## 2. Build My Bike page (`/build-my-bike`)

A new page listing bike builds for a chosen site, with a "New build" button (pick customer, build name, target spec notes).

Opening a build shows the **builder view**:

- A bike diagram/icon with clickable hotspots for the main groups (frame, fork, wheels, drivetrain, brakes, cockpit, saddle, extras).
- Clicking a hotspot opens a picker listing only that customer's in-stock components of matching categories. Selecting one reserves it against the build.
- Below the diagram, a **components list** showing everything added: category, brand/model, quantity, bay location, value, and a remove button.
- A running parts total and a build labour field.

Reserved components move to `reserved` and are consumed (marked `dispatched`/used) when the build completes, freeing the bay.

## 3. Build stages

Builds move through a stepper:

```text
Awaiting build -> Awaiting parts -> Picking parts -> In workshop being built -> Bike built -> Invoiced
```

Stage changes are logged with who and when, shown as a timeline on the build. Stage list is filterable on the index page, with counts per stage.

## 4. Invoicing and completion

- **Bike built** enables "Create invoice": a QuickBooks invoice for the parts total plus build labour, following the same pattern as the inspection invoice (public invoice link surfaced on the build). Success sets the stage to Invoiced.
- On **Bike built**, the finished bike is added back into warehouse stock as a bike item (brand/model/type/value from the build, customer-owned, given a bay), so the customer can request delivery through the existing My Stock flow. The consumed components are removed from available stock.

## 5. Access

Admin, loader and mechanic-facing internal roles can manage builds; the route is registered in the dynamic route-permissions system and added to the Operations section of the menu. Customers see their components and the resulting built bike through My Stock only.

## Technical notes

- Migration: add `item_kind` (enum `bike` | `component`, default `bike`), `component_category` text, `quantity` int default 1, `spec` text to `public.warehouse_stock`; keep existing rows as bikes.
- Migration: `public.bike_builds` (user_id, site_id, name, spec_notes, stage enum, labour_cost, parts_total, invoice_number, invoice_url, invoiced_at, built_at, created_by, linked_stock_id) and `public.bike_build_components` (build_id, stock_id, category, quantity, unit_value) plus `public.bike_build_stage_log`. Each table gets GRANTs, RLS (staff manage; customers read their own), and an `updated_at` trigger.
- New `src/types/bikeBuild.ts`, `src/services/bikeBuildService.ts`, `src/hooks/useBikeBuilds.ts`.
- New `src/pages/BuildMyBikePage.tsx` with components under `src/components/build-my-bike/`: `BuildList.tsx`, `BuildDialog.tsx`, `BikeDiagram.tsx` (SVG with clickable groups), `ComponentPicker.tsx`, `BuildComponentsList.tsx`, `BuildStageStepper.tsx`.
- Component catalogue constant in `src/constants/bikeComponents.ts` mapping diagram hotspots to categories.
- Invoice creation via a new edge function `create-build-invoice`, modelled on the existing inspection invoice function, reusing the QuickBooks token flow.
- Registration in `src/App.tsx`, `src/config/routes.ts`, `src/components/Layout.tsx`.
