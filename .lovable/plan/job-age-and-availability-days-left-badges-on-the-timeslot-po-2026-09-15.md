# Job age and availability-days-left badges on the timeslot popup

Add two new badges to every stop in the Job Scheduling "Get Timeslots" popup (both the grouped multi-job stops and the single stops), next to the existing Customer Available / Collected / inspection badges.

## Badge 1 — Job age

- Days since the order was booked (`created_at`), same idea as the "N days waiting" badge already on the available-jobs list.
- Text: `Booked today`, `Booked 1 day ago`, `Booked N days ago`.
- Colour: grey under 3 days, amber 3–6 days, red 7+ days (matches the existing waiting-badge tiers).

## Badge 2 — Days of availability left

- Uses the customer's available dates for that leg (`pickup_date` for collections, `delivery_date` for deliveries).
- Counts calendar days from the route date being planned to the customer's **last** available date:
  - Last available date is before the route date: `Availability ended (Fri 12 Sep)` — red.
  - Route date is the last available day: `Last day of availability` — red.
  - 1–2 days left: `N days of availability left` — amber.
  - 3+ days left: `N days of availability left` — green.
- Hidden when the customer gave no dates (the existing grey `No Dates Provided` badge already covers that case).

## Technical notes

- File: `src/components/scheduling/RouteBuilder.tsx`.
- New helper next to `getAvailabilityBadge` (~line 145), e.g. `getAvailabilityDaysLeftBadge(jobType, selectedDate, pickupDates, deliveryDates)` using `differenceInCalendarDays` (already imported) against the latest date in the array; job-age badge computed inline like the waiting badge at ~line 3368.
- Rendered in the popup badge rows: grouped stop (~lines 679-731) and single stop (~lines 780-811), both keyed off `selectedDate` (the route date), not the real today.
- Display only — no database, RLS, edge function or scheduling-logic changes.
