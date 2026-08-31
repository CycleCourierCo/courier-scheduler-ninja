# Delivery collection status on the Get Timeslots popup

Yes — the popup already shows a collection badge on every delivery stop, but it judges "collecting today" against the real current date rather than the route date you are scheduling, so a delivery booked for a future date shows "Not Collected" even when a collection is booked in time (and vice versa).

## Current behaviour (in the timeslot popup, per delivery stop)

- `Collected` — order already collected.
- `Collecting on Route` — the matching collection is earlier in the same route.
- `Collection After Delivery!` — the matching collection is later in the same route.
- `Collecting Today` — only if `scheduled_pickup_date` equals the actual system date.
- `Not Collected` — everything else.

## Changes

Make the badge relative to the route's selected date and say when the collection is due:

- `Collecting Today` — collection scheduled on the same day as the route date.
- `Collected Earlier` (green) — collection scheduled before the route date, so the bike will be on board.
- `Collection After Delivery!` (orange) — collection scheduled after the route date, i.e. this delivery cannot be fulfilled. Same treatment as the existing in-route ordering warning.
- `Not Collected` (red) — no collection scheduled at all.

Also surface the collection date on the badge tooltip/text (e.g. `Collecting Wed 2 Sep`) so it is obvious at a glance, and keep it visible for both grouped and single delivery stops in the drawer and the dialog.

## Technical notes

- File: `src/components/scheduling/RouteBuilder.tsx`.
- `getCollectionStatusBadge` gains the popup's `selectedDate` and compares `scheduled_pickup_date` against it instead of `new Date()`; the two existing call sites (grouped stop ~line 586, single stop ~line 705) pass it through.
- Keep the existing in-route ordering checks first — they already reflect the actual sequence, which is more precise than the scheduled dates.
- UI and label logic only; no database, RLS or edge function changes, and nothing changes about what gets sent to customers or Shipday.
