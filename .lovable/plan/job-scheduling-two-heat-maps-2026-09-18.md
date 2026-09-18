# Job Scheduling: two heat maps

Add two new map views to the Job Scheduling page, alongside the existing cluster map. A small view switcher above the map lets you choose:

1. **Clusters** (current behaviour, unchanged default)
2. **Job age** — where the oldest jobs are piling up
3. **Viable on a date** — where the work that can actually be done on a chosen day sits

## 1. Job age heat map

- Every job pin is coloured by how long the order has been waiting (booked date to today):
  - 0–2 days: green
  - 3–6 days: yellow
  - 7–13 days: orange
  - 14+ days: red
- A heat overlay underneath weights older jobs more heavily, so clusters of old work glow hottest.
- Legend shows the age bands and the count of jobs in each.
- Clicking a pin shows the tracking number, job type, bikes and "Booked N days ago".

## 2. Viable-jobs heat map for a selected date

- A date picker (defaults to the date already chosen in the route filters) drives this view.
- A job counts as viable on that date when:
  - **Delivery**: the bike is already collected (or has a collection date before the selected date), the delivery leg is unscheduled, the customer's delivery availability includes the selected date, and any required inspection/repair work is complete.
  - **Collection**: the collection leg is unscheduled and the sender's availability includes the selected date.
- Viable jobs are drawn hot (green collections, red deliveries with a heat overlay showing density); non-viable jobs are hidden.
- Legend shows viable collections, viable deliveries and total bikes for that date.

## Notes

- Both views reuse the same order data already loaded on the page — no new queries or backend changes.
- Existing cluster view, filters, Route Builder and driver panels are untouched.
- Northern Ireland legs keep using the existing leg-contact logic so ferry-partner addresses plot correctly.

## Technical details

- Add `leaflet.heat` and wrap it in a small `HeatLayer` component for react-leaflet.
- New components under `src/components/scheduling/`: `JobAgeHeatMap.tsx`, `ViableJobsHeatMap.tsx`, plus a shared `heatJobPoints.ts` helper that turns `OrderData[]` into `{lat, lon, type, orderId, weight}` points (extracted from the existing `extractClusterPoints` logic in `ClusterMap.tsx`).
- `JobScheduling.tsx` gains a `mapView: 'clusters' | 'age' | 'viable'` state and a `ToggleGroup`; it renders one of the three maps and passes `orders` (unfiltered) for the heat views so filters don't hide the picture.
- Viability predicate mirrors the delivery/collection rules already in `filteredOrdersForMap` and `RouteBuilder`, extracted into the shared helper so behaviour stays consistent.
