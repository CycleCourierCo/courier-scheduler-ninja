## Goal
Add a filter on the Job Scheduling page to show only jobs whose availability dates have all passed (i.e. every chosen pickup/delivery date is before today).

## Why
Users need to quickly identify "stale" jobs where the sender/receiver chose dates like 1st–8th but today is the 12th, so those jobs need re-contacting or re-scheduling.

## Changes

### 1. RouteBuilder — add filter toggle
- Add `showExpiredDatesOnly` boolean state (lifted to `JobScheduling.tsx` like the other filters).
- Add a new Switch in the filter bar (next to "Collected (ready to deliver)") labelled **"Expired availability dates"**.
- When enabled, `getJobsFromOrders()` will additionally filter out any job that still has at least one availability date >= today. Only jobs whose **latest** availability date is strictly before today are kept.
  - For pickup jobs, check `pickup_date` array.
  - For delivery jobs, check `delivery_date` array.
  - If the date array is empty/missing, the job is NOT shown (can't determine expiry).

### 2. JobScheduling — lift state
- Add `showExpiredDatesOnly` state variable.
- Pass it down to `RouteBuilder` alongside the other lifted filters.
- Update `filteredOrdersForMap` (used by `ClusterMap`) to respect the same expired-dates logic, so the cluster view stays in sync.

### 3. Visual indicator (optional but helpful)
- On each unassigned job card, add a small red/orange badge if the job's dates have expired, making them easy to spot even when the filter is off.

## Files to modify
- `src/pages/JobScheduling.tsx`
- `src/components/scheduling/RouteBuilder.tsx`

## No database changes required
All data (`pickup_date`, `delivery_date`) is already available on the `orders` rows loaded by the page.