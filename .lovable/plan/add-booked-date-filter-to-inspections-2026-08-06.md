# Add "Booked" date filter to inspections

The filter bar currently has one date filter ("Collected", based on collection confirmation / pickup date). Add a second, independent date filter for when the job was **booked** (order created date).

## What changes

- New date filter block labelled **Booked** next to the existing **Collected** one, with the same options: Any date, Last 7 days, Last 30 days, This month, Custom range (from/to pickers).
- Both filters can be used together — a job must match both to show.
- Booked filter gets its own removable chip (prefixed "Booked:") so it's distinguishable from the collected-date chip, counts toward the active-filter badge, and is reset by "Clear all".
- Existing collected-date chip gets a "Collected:" prefix for clarity.
- Works the same on mobile (inside the Filters popover) and desktop, and applies across all tabs and their counts.

## Technical notes

- `src/components/inspections/InspectionFilters.tsx`: extend `InspectionFilterState` with `bookedPreset`, `bookedFrom`, `bookedTo`; add them to `EMPTY_INSPECTION_FILTERS` and `countActiveInspectionFilters`. Refactor the existing inline date control into a small reusable renderer parameterised by label + state keys, then render it twice (Collected, Booked).
- `src/pages/BicycleInspections.tsx`: in the `filteredInspections` memo, resolve the booked range using the same preset logic and compare against `o.created_at` (order creation timestamp already loaded); rows with no `created_at` are excluded when a booked range is active, matching the existing collected-date behaviour.
