# Expiring & expired dates page

## What it shows

A new Operations page ("Expiring Dates", `/expiring-dates`) listing order legs that still need a customer date and whose dates are running out or gone. Four side-by-side columns (stacking on mobile), each with a count in its heading:

- **Last date today** — the leg's final available date is today (0 days left).
- **Last date tomorrow** — 1 day left.
- **Last date in 2–3 days** — 2 or 3 days left.
- **Expired** — every date on the leg has passed. Shows "X days expired" counted from the last date, most-overdue first.

Each card shows: tracking number, customer name, bike summary, leg type (Collection / Delivery), the chosen dates, and the days figure. Columns sort soonest/most-overdue first.

Legs **with no dates at all are excluded** — this page is only about jobs that had dates. Legs already scheduled or completed are excluded too, matching the nightly expiry rules:

- Collection rows: order not collected and no scheduled pickup date.
- Delivery rows: order not delivered, no scheduled delivery date, and not a Box My Bike / warehouse-storage order (those never get a customer delivery date).

An expired leg that already has a "new dates requested" flag gets a small "Asked" badge so staff don't chase it twice. No buttons or actions on this page — it's a watch list.

## Access

Added to the Operations menu as "Expiring Dates", default role route_planner (admins always see it), permission-checked like other pages, so it can also be granted to other roles from Route Permissions.

## Technical changes

**`src/pages/ExpiringDatesPage.tsx`** (new)

- React Query fetch from `orders` (`status` not in cancelled/delivered) selecting the same fields Job Scheduling uses, plus `is_warehouse_storage` and a join to `order_leg_availability` (leg status + `redate_requested_at`) for the "Asked" badge.
- All date maths on `YYYY-MM-DD` strings in Europe/London (`en-CA` formatter), same as the rest of scheduling. Today = London today.
- Four-column grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-4`) with per-column lists; loading spinner and per-column empty states in the existing office style (Layout + DashboardHeader, office-density).

**`src/config/routes.ts`** — add `expiring-dates` route (Operations, CalendarClock icon, `defaultRoles: ["route_planner"]`).

**`src/App.tsx`** — lazy import + `<Route path="/expiring-dates">` wrapped in `ProtectedRoute`.

## Verification

- TypeScript check passes.
- Preview: page renders the four columns, day counts match live data, and no-date jobs are absent. Check as route_planner (menu entry visible) and confirm a role without the permission gets the standard no-access screen.
