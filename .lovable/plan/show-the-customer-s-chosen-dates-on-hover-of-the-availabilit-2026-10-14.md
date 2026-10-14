# Show the customer's chosen dates on hover of the availability badge

In the Route Timeslots popup (Get Timeslots), hovering the availability badge — "Customer Available", "Not Customer Date", "Dates Expired" — reveals the actual dates the customer gave for that leg, so you don't have to open the order to check.

## What you'll see

Hovering (or tapping on a phone) the badge opens a small popup:

```text
Collection dates
  ✓  Mon 12 Oct      <- the day being planned
     Tue 13 Oct
     Wed 14 Oct
     Fri 16 Oct
  3 dates · 2 still ahead
```

- One date per line, oldest first, duplicates removed.
- The day you're planning gets a tick and is highlighted; dates already gone are greyed with "(past)".
- Title says "Collection dates" for a collection stop and "Delivery dates" for a delivery stop.
- The badge itself looks exactly as it does today — same wording, colours and position.
- Works on both layouts of the popup: single stops and grouped "Multiple stops" rows.
- "No Dates Provided" stays as it is (there is nothing to list).

## Technical notes

- Single file: `src/components/scheduling/RouteBuilder.tsx`.
- New local component `AvailabilityDatesPopover` placed next to `BikeCountBadge` (~line 471), reusing that badge's proven pattern: a Radix `Popover` that opens on hover on desktop and toggles on tap on touch devices (`useIsMobile`), with click-to-pin.
- Props: `jobType`, `selectedDate`, `pickupDates`, `deliveryDates`, and the already-rendered badge element as the trigger — so one component serves both call sites.
- Dates formatted with date-fns `format(d, "EEE d MMM")`, sorted/deduped; planned day compared with `format(selectedDate, "yyyy-MM-dd")`; past dates compared with today using the same local-date convention as the existing `getAvailabilityDaysLeftBadge`.
- Swap the two badge renders: grouped rows (~line 823) and single stops (~line 957).

## Out of scope

- No change to what counts as a customer date, to scheduling logic, or to anything sent to customers — display only, no database or edge function changes.
- The "N availability dates left" badge is unchanged; the same popup can be added to it later if wanted.

## Verification

- Open Get Timeslots on a route with jobs, hover the availability badge on a single stop and on a grouped stop, and confirm the listed dates match that customer's availability and the ticked date is the route day.
- Check a "Not Customer Date" and a "Dates Expired" stop show the right list.
- On a phone, tap the badge to open it and tap elsewhere to close.
