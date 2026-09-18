# Availability badge: count remaining confirmed dates

## Current behaviour (confirmed in code)

`getAvailabilityDaysLeftBadge` in `src/components/scheduling/RouteBuilder.tsx` (line 195) counts **calendar days** from the route date to the customer's *last* confirmed date — so 8 confirmed dates with gaps would show a large number even if 5 dates have passed.

## Change

Switch the badge to count **remaining confirmed dates** — the number of the customer's confirmed availability dates that fall on or after the route date being planned.

- Take the relevant date array (`pickup_date` for collections, `delivery_date` for deliveries).
- Count dates where date >= route date: `remaining = dates.filter(d => d >= routeDateStr).length`.
- Text and colours:
  - `remaining === 0`: `Availability ended (Fri 12 Sep)` — red (keep last-date label).
  - `remaining === 1`: `1 availability date left (Fri 12 Sep)` — red if the route date is that last date, otherwise amber.
  - `remaining === 2`: `2 availability dates left` — amber.
  - `remaining >= 3`: `N availability dates left` — green.
- Hidden when no dates were given (existing `No Dates Provided` badge covers that).

## Technical notes

- File: `src/components/scheduling/RouteBuilder.tsx`, function `getAvailabilityDaysLeftBadge` (~lines 195–235).
- Render sites already pass the right arrays (grouped stop ~line 703, single stop ~line 866) — no other changes needed.
- Display only — no database or scheduling-logic changes.
