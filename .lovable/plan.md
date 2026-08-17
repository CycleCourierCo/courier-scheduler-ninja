# Mechanic timeslip filters, totals, and a fixed driver list

## Mechanic timeslips tab

Add a filter row alongside the existing Status filter:

- **Mechanic** — dropdown listing all mechanics (including people who hold the mechanic role plus other roles).
- **Date range** — From / To date pickers with a "Clear dates" action, plus quick presets (This week, Last week, This month).

Filters combine with Status and are applied server-side so totals reflect the whole filtered set, not just a page.

## Totals for the filtered period

Replace the single "Total pay shown" card with a small totals strip covering the filtered rows:

- Total hours
- Total lunch hours
- Total pay
- Number of shifts and number of distinct mechanics
- Average hours per shift and average pay per hour

## Driver list showing multi-role drivers

The driver dropdown on the driver timeslip filters currently lists only profiles whose single `role` column equals `driver`, so anyone whose driver role sits in `user_roles` alongside another role (loader, mechanic, etc.) is missing. It will instead resolve drivers from `user_roles`, unioned with the legacy `profiles.role` value, deduplicated and sorted by name. The same approach is used for the new mechanic dropdown.

## Technical notes

- `listAllMechanicTimeslips` in `src/services/mechanicTimeslipService.ts` already accepts `driverId`, `dateFrom`, `dateTo` — wire the new UI state into it and into the react-query key.
- New helper in `src/services/mechanicTimeslipService.ts` (or a small shared hook) to list users by role: select `user_id` from `user_roles` where `role = 'driver' | 'mechanic'`, fetch matching `profiles` (id, name, email), merge with `profiles.role = <role>` rows, dedupe by id.
- Filter/totals UI lives in `src/components/timeslips/MechanicTimeslipsTab.tsx`; totals computed from the fetched filtered rows with `useMemo`.
- `src/components/timeslips/TimeslipFilters.tsx` swaps its `profiles.role = 'driver'` query for the new role-aware lookup.
- Dates stored as `YYYY-MM-DD`; format with Europe/London-safe string slicing, no UTC conversion.
- No schema changes.
