# Job Type Filter — Job Scheduling Page

Add a 3-option segmented toggle that filters which job types appear on the Job Scheduling page. All existing functionality (date filter, "show collected only", "collecting before delivery", drag-to-route, Shipday verify, save/load route) keeps working unchanged inside each mode.

## UX

- New segmented control with three options: **All**, **Collections only**, **Deliveries only**.
- Default: **All** (preserves current behaviour).
- Placement: in the existing filter row on `JobScheduling.tsx`, next to the "Show K-means Clusters" switch. Stacks below it on mobile.
- Selection persists in component state for the session (no URL param needed for now).

## Behaviour

The toggle controls a single `jobTypeFilter: 'all' | 'collection' | 'delivery'` value lifted in `JobScheduling.tsx` (same pattern as the existing lifted filters).

- **All** — current behaviour. An order shows if it has a valid pickup OR a valid delivery.
- **Collections only** — an order only shows if it has a valid pickup job. Deliveries are hidden from the map and from the route builder's draggable job list.
- **Deliveries only** — mirror of the above. Only valid delivery jobs are shown. The "Collecting before delivery date" and "Show collected only" filters continue to apply to deliveries as they do today.

## Technical changes

Frontend only. No DB, no service layer changes.

1. **`src/pages/JobScheduling.tsx`**
   - Add `const [jobTypeFilter, setJobTypeFilter] = useState<'all'|'collection'|'delivery'>('all')`.
   - Render a shadcn `ToggleGroup` (type="single") in the filter row.
   - Update `filteredOrdersForMap` memo: when filter is `collection`, drop `hasValidDelivery` from the OR; when `delivery`, drop `hasValidPickup`. Keep the existing date / collected / "collecting before delivery" logic intact for whichever side is active.
   - Pass `jobTypeFilter` into `RouteBuilder` as a new prop.

2. **`src/components/scheduling/RouteBuilder.tsx`**
   - Accept `jobTypeFilter` prop.
   - In the place(s) where pickup and delivery jobs are derived from an order into the draggable job list, filter out the opposite type when `jobTypeFilter !== 'all'`.
   - Job counts shown in the header should reflect the filtered set so the user sees the correct totals for the active mode.
   - No change to save-route, CSV import, Shipday verify, or drag/drop logic — they all operate on the already-filtered job list.

3. **`src/components/scheduling/ClusterMap.tsx`**
   - No code change required: it already renders whatever orders/jobs it receives. The narrower `filteredOrdersForMap` plus job-type aware marker rendering already lives inside, but verify during implementation that markers for the hidden type are suppressed. If not, add a small prop-driven filter on the marker render step only.

## Out of scope

- Persisting the toggle in the URL or localStorage.
- Changing cluster math (clusters will recompute naturally from the filtered orders).
- Any change to scheduling, Shipday, or backend logic.
