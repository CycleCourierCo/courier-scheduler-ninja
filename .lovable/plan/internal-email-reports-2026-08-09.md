# Internal Email Reports

Send operational summary reports to **Info@cyclecourierco.com** — a daily digest after the proactive customer-update cron finishes, plus daily snapshots and fuller weekly roll-ups for drivers, vans and inspections.

## 1. Daily customer-update summary

Sent after the proactive updates job completes for the day (all chunks done).

Contents:
- Total live orders scanned, updates due, emails sent, skipped, failed.
- Breakdown by update type (collection availability chaser, delivery availability chaser, in-workshop update, awaiting-scheduling update, ferry/NI updates, etc.) with how many customers each reached.
- Unique customers contacted vs. orders touched.
- Failures list: order reference, recipient, error reason.
- Deliberately skipped orders with the rule that skipped them (e.g. still in inspection, already updated in last 2 days).

Because the job runs as multiple parallel chunks, each chunk writes its counts to a small run-log table; a follow-up invocation aggregates the day's rows and sends one email (no duplicate reports).

## 2. Daily operations snapshot (previous day)

One email covering yesterday:
- Bikes collected, delivered, delivered to ferry, cancelled.
- Driver line per driver: stops completed, collections, deliveries, on-time rate vs. the timeslot window, hours clocked.
- Inspections booked, inspections completed, repairs completed, parts + labour value, jobs invoiced / awaiting invoice.
- Van alerts due in the next 14 days (MOT, service, insurance, off-road vehicles).
- Exceptions worth eyeballing: orders with no movement for 7+ days, bikes in storage bays over 14 days, unallocated collected bikes.

## 3. Weekly driver report (Monday morning, previous Mon–Sun)

Per driver:
- Stops, bikes collected, bikes delivered, on-time rate, hours from timeslips, pay for the week, pay-per-bike and pay-per-stop.
- Week-on-week movement on bikes and on-time rate.
- Top regions covered.
Plus a fleet-wide totals row and a ranked table.

## 4. Weekly van report (Monday morning)

Per vehicle:
- Status, mileage change over the week, MOT/service/insurance due dates with days remaining (red if under 30 days).
- Maintenance logged in the week and cost.
- Days off-road / in service / in repair.
- Upcoming maintenance intervals coming due.

## 5. Weekly workshop / inspection report (Monday morning)

- Inspections booked vs. completed, repairs completed, average turnaround from collection to repaired.
- Parts vs. labour revenue, average parts and labour spend per bike.
- Mechanic table: inspections, repairs, hours clocked, revenue, efficiency.
- Backlog: bikes awaiting inspection / awaiting repair / awaiting parts, with age buckets.
- Billing: invoiced, auto-settled (no issues / declined / zero value), still uninvoiced with value at risk.

## Technical notes

- New edge function `send-internal-reports` with a `report` parameter (`customer-updates`, `daily-ops`, `weekly-driver`, `weekly-van`, `weekly-workshop`), Resend via the existing `notification.cyclecourierco.com` sender and `Info@cyclecourierco.com` reply-to, shared HTML table/section helpers modelled on `send-route-report`.
- Data is read server-side with the service role, reusing the same aggregation rules already in `driverAnalyticsService`, `mechanicProfitabilityService`, `workshopScheduleService` and `bikeValueAnalyticsService` so figures match the analytics pages. Pagination loops to stay clear of the 1,000-row limit.
- `order_update_log` (`stage_key`, `side`, `recipient`, `sent_at`) drives the customer-update breakdown; a new `order_update_run_log` table stores per-chunk counters so the daily digest can aggregate a fan-out run.
- Cron: `pg_cron` jobs via `SECURITY DEFINER` wrappers matching the existing pattern — customer-update digest ~20 minutes after the 08:00 fan-out, daily ops snapshot 07:00, three weekly reports Monday 07:30. All accept `X-Cron-Secret` and also allow admin JWT so reports can be triggered manually.
- Admin UI: a "Reports" card on the analytics page with a Send now button per report and an optional date range, so any report can be re-sent on demand.
- All timestamps and week boundaries computed in `Europe/London`; no PII beyond names/refs in logs.
