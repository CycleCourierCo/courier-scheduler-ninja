# Driver rota, availability and holiday requests

## What you get

1. **Driver Holiday Requests page** (drivers) — a driver picks a date range (full or half day) with an optional note and submits it. They see their past and upcoming requests with status (Pending / Approved / Declined) and can cancel one that is still pending.
2. **User Management additions** (admins)
   - **Availability** tab on each driver: tick which weekdays they normally work, with optional start/finish times (e.g. Mon–Fri 07:00–19:00).
   - **Holiday approvals** panel at the top of User Management: all pending requests, with Approve / Decline and an optional reason. The driver gets an email with the decision.
3. **Drivers Rota page** (route planners and admins) — a week view with a row per driver and a timeline per day:
   - Green bar for the hours they can work that day
   - Striped/red block for approved holiday, amber for pending holiday
   - Grey for days they don't work or company bank holidays
   - Week back/forward, "today" button, and a count of available drivers per day at the top
   - Tap a driver-day to see details. Phones get a stacked day-by-day list.

## Access

- Rota: route planners + admins (added to the Operations menu and the route-permissions screen).
- Holiday requests page: drivers (and admins).
- Approvals and availability editing: admins only.

## Technical details

- New tables (with grants + RLS):
  - `driver_weekly_availability` (driver_id, weekday 0–6, is_available, start_time, end_time; unique per driver+weekday). Admin write; admins, route planners and the driver themself read.
  - `driver_holiday_requests` (driver_id, start_date, end_date as `YYYY-MM-DD`, half_day, note, status pending/approved/declined/cancelled, decided_by, decided_at, decision_reason). Drivers insert/read their own and can cancel pending ones; admins read/decide all; route planners read.
  - Validation trigger: end ≥ start; drivers can't change status except to cancelled.
- Rota combines weekly availability + holiday requests + existing company `holidays` table, Europe/London dates.
- New pages `DriversRota.tsx` and `DriverHolidayRequests.tsx`, routes `/drivers-rota` and `/my-holidays` in `App.tsx` and `config/routes.ts`.
- `EditUserDialog.tsx` gets an Availability tab for driver users; new `HolidayApprovalsCard` on `UserManagement`.
- Decision email via the existing Resend send path (branded layout, reply-to Info@).
- Not included now: feeding the rota into route generation's van/driver counts — can follow once the rota is in use.
