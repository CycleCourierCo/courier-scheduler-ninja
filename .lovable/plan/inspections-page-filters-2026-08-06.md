# Inspections page filters

Add a compact filter bar to the inspections page (next to the existing search box and sort control) that applies to every tab at once.

## Filters

- **Date range** — filters on the date the bike was collected (falls back to order created date). Presets: Last 7 days, Last 30 days, This month, plus a custom from/to date picker.
- **Customer who booked** — the account the order belongs to, e.g. a dealer or trade account. Dropdown listing only the customers present in the current inspection list.
- **Mechanic who inspected** — the mechanic recorded against the inspection.
- **Mechanic who repaired** — any mechanic who marked at least one repair complete on that bike.
- **Bike category** — the bike type chosen at inspection (road, MTB, e-bike, etc.), since it's already stored.
- **Billing state** (admin/manager only) — Invoiced / No invoice needed / Not settled.

Behaviour:
- Filters combine with the existing free-text search and sort.
- Each active filter shows as a removable chip, plus a "Clear all" button.
- Tab counts update to reflect the filtered set.
- The filter bar collapses into a "Filters" button with a badge count on mobile so it doesn't crowd the screen.
- Filters are hidden for customer-facing users; they keep search only.

## Technical notes

- Order rows already carry `collection_confirmation_sent_at`, `created_at`, and `user_id`; the joined inspection carries `bike_type`, `inspected_by_id/name`, `invoice_number`, and `invoice_skipped_at`; issues carry `resolved_by_id/name`. No schema changes needed.
- `getPendingInspections` in `src/services/inspectionService.ts` gains a lookup of `profiles` (id, name, email, company) for the distinct `user_id` values so the booking-customer dropdown can show real names rather than IDs.
- Filter state lives in `src/pages/BicycleInspections.tsx` and is applied inside the existing `filteredInspections` memo, before the per-status tab splits, so all tab counts stay consistent.
- Dropdown option lists are derived from the loaded data (distinct inspector names, resolver names, customers, bike types) so no extra queries are required.
- The filter bar is extracted into `src/components/inspections/InspectionFilters.tsx` to keep the page file manageable.
