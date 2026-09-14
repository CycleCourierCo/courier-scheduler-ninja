# Clarify the "Collecting Today" badge on Job Scheduling

## What's happening now

On a delivery stop, the badge compares the job's booked collection date against the **date you are building the route for** (not the real today). The logic is right, but the wording is misleading:

- A collection booked the same day as the route shows `Collecting Today` even when that collection is on a completely different route — the bike won't be on this van, so it must not read as OK.
- "Today" reads as the real today, not the route date.

## Changes

Reword and re-colour the date-based badges on delivery stops, relative to the route date being planned:

- Collection earlier in **this** route: `Collecting on Route` — blue, unchanged (this is the only "fine, it's on the van" same-day case).
- Collection already done: `Collected` — green, unchanged.
- Collection booked the same day as the route but **not on this route**: `Collected elsewhere same day (Wed 16 Sep)` — **orange warning**, since the bike won't be on this van and the route can't fulfil the delivery.
- Collection booked before the route date: `Collected earlier (Mon 14 Sep)` — green, as now.
- Collection booked after the route date: `Collection after delivery! (Fri 18 Sep)` — orange, as now.
- No collection booked: `Not Collected` — red, unchanged.

## Technical notes

- File: `src/components/scheduling/RouteBuilder.tsx`, `getCollectionStatusBadge` (~lines 238-311). It already receives `routeDate` (`selectedDate`) from both call sites (grouped stop ~line 651, single stop ~line 796).
- The same-route check (matching pickup job in `allJobs`) already runs first and returns `Collecting on Route`; the date-comparison branch therefore only ever fires for collections that are not on this route, so the same-day branch there becomes the orange `Collected elsewhere same day (…)` warning.
- Display text/colour only — no database, RLS, edge function or scheduling-logic changes.
