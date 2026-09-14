# Clarify the "Collecting Today" badge on Job Scheduling

## What's happening now

On a delivery stop, the badge compares the job's booked collection date against the **date you are building the route for** (not the real today). So when you plan a route for next Wednesday and the bike is booked for collection that same Wednesday, it correctly means "collected the same day as this route" — but the wording says "Collecting Today", which reads as today's date and is confusing.

The comparison logic is right; only the wording is wrong.

## Change

Reword the date-based badges on delivery stops so they always name the day, relative to the route date:

- Same day as the route: `Collecting same day (Wed 16 Sep)` — amber, as now.
- Before the route date: `Collected earlier (Mon 14 Sep)` — green, as now.
- After the route date: `Collection after delivery! (Fri 18 Sep)` — orange, as now.
- No collection booked: `Not Collected` — red, unchanged.
- Already collected, or collection earlier in the same route: unchanged (`Collected`, `Collecting on Route`, `Collection After Delivery!`).

## Technical notes

- File: `src/components/scheduling/RouteBuilder.tsx`, `getCollectionStatusBadge` (~lines 277-304). It already receives `routeDate` (`selectedDate`) from both call sites (grouped stop ~line 651, single stop ~line 796) and compares against it, so only the badge text changes; the same-day branch gains the formatted date label.
- Display text only — no database, RLS, edge function or scheduling-logic changes.
