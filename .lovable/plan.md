# Availability-days badge: count actual confirmed dates

## Goal
Change the "days of availability left" badge in the Route Builder's Get Timeslots popup to count the customer's actual remaining confirmed dates, instead of calendar days to their last date.

## Current behaviour
`getAvailabilityDaysLeftBadge` in `src/components/scheduling/RouteBuilder.tsx` computes `differenceInCalendarDays(lastAvailableDate, routeDate)`. If a customer confirmed Mon 21st, Wed 23rd and Fri 25th and the route date is Mon 21st, it shows "4 days of availability left" even though only 3 dates remain.

## New behaviour
- Count confirmed dates (pickup dates for collection jobs, delivery dates for delivery jobs) that fall on or after the selected route date.
- Badge text becomes `"X of Y dates left"` where X = remaining dates from the route date onward, Y = total confirmed dates.
- If the route date itself matches a confirmed date: `"Last available date"` (red) when it is the final one, otherwise show the remaining count including that day.
- If no confirmed dates remain after the route date: keep the existing red "Availability ended (last date)" message.
- Colour rules: green when more than 2 dates remain, amber at 2 or fewer, red for the last date or expired availability.
- "No Dates Provided" case is unchanged.

## Technical details
- Edit only `getAvailabilityDaysLeftBadge` in `src/components/scheduling/RouteBuilder.tsx` (~lines 195-235): replace the calendar-day diff with a filter/count of dates `>= routeDateStr`.
- No data or other component changes; both pickup and delivery usages pick up the new logic automatically.
- Verify with `bunx tsgo --noEmit -p tsconfig.app.json`.
