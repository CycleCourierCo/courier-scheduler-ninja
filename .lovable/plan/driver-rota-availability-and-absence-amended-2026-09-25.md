# Driver rota, availability and absence (amended)

## Scope: active drivers only

- Only active drivers (the existing `is_active` flag on the user's profile) appear in the rota, availability editing, approvals, "on behalf of" entry, cover counts and allowance tracking.
- Inactive drivers can't submit requests or open `/my-holidays`.
- When a driver is deactivated, their pending requests are cancelled automatically and they drop off the rota. Their past records are kept.

## Active-accounts filter across the app

- One shared helper, `getActiveUsers(role, { includeInactive })` plus a `useActiveUsers` hook, used by every picker and filter instead of filtering in each component.
- Apply it to timeslip filters, loading filters, task assignment and task filters, route planning and driver/van pickers, and every other user or driver dropdown. During the build I'll search the codebase for all of these and list each one that was changed.
- Historical records (old timeslips, completed jobs, past tasks) still show names of inactive drivers. Only pickers for new or current work hide them. Filters used to look back at history get a **Show inactive** toggle, off by default.

## Pages

1. **My Holidays** (`/my-holidays`, active drivers)
   - Request full-day leave: holiday, unpaid or other. There are no half days.
   - The note field is labelled "Visible to admins only".
   - Requests that overlap the driver's own pending or approved requests are blocked.
   - Shows days used and days remaining this leave year.
   - Drivers can cancel a pending request. For an approved request, they can ask for it to be cancelled, which flags it for an admin.
   - Once a request is submitted, its dates and type are locked. To change them, the driver cancels and resubmits.
2. **User Management** (admins)
   - **Availability** tab per driver:
     - Weekly pattern (default Sun–Thu)
     - One-off date overrides with times and a note
     - Annual entitlement and leave year start date
     - Depot (optional)
   - **Absence approvals** panel with a count badge on the User Management menu item. For each request it shows:
     - Approve and Decline, with a reason
     - How many other active drivers are off on those dates
     - A warning when cover drops below the minimum drivers per day (a setting admins can change)
     - The driver's allowance used and remaining
     - Cancel-requested flags, and admin cancellation of approved leave
   - **Log absence on behalf of a driver** (any type, including sick), saved as already approved.
3. **Drivers Rota** (`/drivers-rota`, route planners and admins)
   - Week view running Sun–Sat, with a timeline row for each driver.
   - Colours:
     - Green: working hours (the weekly pattern, replaced by any override for that date)
     - Red: approved absence
     - Amber: pending absence
     - Grey: non-working days and bank holidays
   - Daily count of available drivers, with a warning below the minimum.
   - Depot filter.
   - Route planners see dates and status only, never the note.
   - On phones, days are stacked in a list.

## Notifications

- New request: email to admins, plus the badge count.
- Decision or cancellation: email to the driver. This uses the existing branded Resend sender with reply-to Info@.

## Not included

- Route generation still won't use rota data for now.

## Technical details

- **`profiles`**: add nullable `depot_id`, `annual_leave_days` and `leave_year_start` (month and day).
- **`driver_weekly_availability`**:
  - Columns: driver_id, weekday 0–6 (0 = Sunday), is_available, start_time, end_time. One row per driver and weekday.
  - Admins can edit. Admins, route planners and the driver can read.
- **`driver_availability_overrides`**:
  - Columns: driver_id, date, is_available, start_time, end_time, note. One row per driver and date.
  - Admins can edit. Admins, route planners and the driver can read.
- **`driver_absence_requests`**:
  - Columns: driver_id, type (holiday/sick/unpaid/other), start_date, end_date (`YYYY-MM-DD`), note, status (pending/approved/declined/cancelled), cancel_requested, decided_by, decided_at, decision_reason, created_by.
  - Route planners read it through a view or RPC that leaves out `note`.
- **Validation trigger** on absence requests:
  - end_date must be on or after start_date, and the driver must be active.
  - Blocks overlaps with the driver's own pending or approved requests.
  - Drivers may only insert holiday, unpaid or other as pending, and can't change dates or type after submitting.
  - Only admins can set approved or declined. Drivers can set cancelled on pending requests, or cancel_requested on approved ones.
  - The server sets `decided_by` and `decided_at`.
- **Deactivation trigger** on `profiles.is_active` changing to false: cancels that driver's pending requests.
- **`rota_settings`**: holds the minimum drivers per day (single row, admins can edit).
- **Allowance calculation**: counts days in the leave year that the driver normally works (weekly pattern plus overrides), excluding the company `holidays` table. Only approved holiday leave counts. Dates use Europe/London.
- **New pages**:
  - `DriversRota.tsx` and `DriverHolidayRequests.tsx`, with routes in `App.tsx`.
  - Entries in `config/routes.ts`: rota (Operations, route_planner) and my-holidays (driver).
- **User Management**:
  - Availability tab in `EditUserDialog.tsx`
  - `AbsenceApprovalsCard`
  - `LogAbsenceDialog`
- **Edge function `driver-absence-notify`**: sends the admin and driver emails, with auth checks and CORS.
- Every new table has grants and RLS, following the project's standard pattern for RLS performance.
