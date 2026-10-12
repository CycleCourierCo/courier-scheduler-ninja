# Drivers set their own unavailable dates — no requests, no allowance

## What changes for drivers

- The **"My holidays" page becomes "My availability"**. Instead of sending a time-off request and waiting for approval, a driver simply picks the dates they **can't work** on a calendar and saves. It takes effect immediately.
- They can add or remove unavailable dates at any time, with an optional note (e.g. "dentist", "holiday").
- **No 28-day allowance** — the allowance/used/remaining counters disappear. There's no limit on how many days they can mark.
- The Drivers Rota updates straight away: their unavailable dates show as "Off" (with their note visible to admins/planners), and the "X available" counts drop accordingly.

## What changes for admins

- Nothing to approve — the pending/approved absence workflow is no longer used for driver-set dates.
- Admins can still edit any driver's dates from the rota's edit button (existing dialog, now writing the same unavailable dates).
- The admin "Log absence" and absence approvals screens stay in place for now (sick pay records etc.), but the plan removes them too if you'd rather — say the word.

## How it works (technical)

- Reuse the existing `driver_availability_overrides` table (per-driver, per-date, available yes/no + note). The rota already reads it via `resolveDay`, so no rota changes are needed.
- **Database migration**: add a policy letting each driver add/edit/delete **their own** override rows (currently admin-only). No new tables.
- `src/pages/DriverHolidayRequests.tsx` → rewritten as "My availability": multi-date calendar picker (future dates), save/clear per date, list of upcoming unavailable dates with remove. No `createRequest`, no `computeAllowance`, no status badges.
- `DriverRotaEditDialog.tsx` (admin): the holidays tab switches from absence requests to the same per-date unavailable editor, so admin and driver edits land in the same place and the rota stays consistent.
- Rota legend: driver-set unavailable days render as "Off" with the note in the popover (existing behaviour for overrides).
- Menu label "My holidays" → "My availability" (route unchanged so old links still work).

## Out of scope / notes

- Existing past absence-request records are left untouched (history preserved).
- The driver-absence email notifications stop for driver-set dates (there's nothing to approve); admin-logged absences still notify.
