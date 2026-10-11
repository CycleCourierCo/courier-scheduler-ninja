# Show each mechanic's daily work on their timeslip page

## What you'll see

On the Mechanic Clock page (where a mechanic sees their own timeslips), each day's timeslip will also list the work they did that day:

- **Inspections completed** — bikes they inspected that day, showing the bike name and order tracking number.
- **Repairs completed** — each repair they marked as done that day, showing the repair description and the bike/order it belongs to.
- A short summary line per day, e.g. "2 inspections, 3 repairs".
- Days with no recorded work simply show "No work recorded" — nothing breaks.

This is read-only; nothing about clocking in/out, pay, or approvals changes.

## How it works (technical)

- Page: `src/pages/MechanicClock.tsx`, history list from `listMyMechanicTimeslips` (last 60 slips).
- New service function in `src/services/mechanicTimeslipService.ts` (or a small new `mechanicWorkService.ts`):
  - Fetch `bicycle_inspections` where `inspected_by_id = user.id` and `inspected_at` falls within the date range covered by the loaded timeslips — select `inspected_at, bike_brand, bike_model, order_id`.
  - Fetch `inspection_issues` where `resolved_by_id = user.id` and `resolved_at` in the same range — select `resolved_at, issue_description, order_id`.
  - Group both by calendar date (Europe/London) and attach to each timeslip by its `date`.
- Render inside each history card: a "Work done" section listing items with time (HH:mm), bike name, and tracking number (looked up from the orders already available, or a light `orders` select of `id, tracking_number` for the involved order ids).
- RLS: mechanics already read their own inspections/issues; queries are scoped to the signed-in user's id, so no policy changes needed. No database migration required.

## Not included

- No changes to pay calculation or approval flow.
- No admin view changes (admins already have MechanicTimeslipsTab; can be added later if wanted).
- Cleaning/degrease checklist steps are not listed (only inspections and repairs); can be added later.
