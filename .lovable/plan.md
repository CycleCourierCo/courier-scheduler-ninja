# Expiring & expired dates page

## What it shows

A new Operations page ("Expiring Dates", `/expiring-dates`) listing order legs that still need a customer date and whose dates are running out or gone. Two groups, each with a count:

- **Expiring within 3 days** — the leg's last future date is today or within the next 3 days. Shows "X days left" (0 = today is the last day).
- **Expired** — every date on the leg has passed. Shows "X days expired" counted from the last date.

Rows show: tracking number, customer name, bike summary, leg type (Collection / Delivery), the chosen dates, and the days figure. Sorted soonest/most-overdue first within each group.

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
- Group/sort client-side; loading spinner and empty state in the existing office style (Layout + DashboardHeader, office-density).

**`src/config/routes.ts`** — add `expiring-dates` route (Operations, CalendarClock icon, `defaultRoles: ["route_planner"]`).

**`src/App.tsx`** — lazy import + `<Route path="/expiring-dates">` wrapped in `ProtectedRoute`.

## Verification

- TypeScript check passes.
- Preview: page renders with the two groups, correct day counts against live data, and no-date jobs absent. Check as route_planner (menu entry visible) and confirm another role without the permission gets the standard no-access screen.
