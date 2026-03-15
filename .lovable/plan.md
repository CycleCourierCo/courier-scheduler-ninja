

## Show Opening Hours Status on Route Timeslot Job Cards

### Problem
The Route Timeslots view doesn't indicate whether a job's estimated time falls within the business's opening hours/days. Route planners need this visibility directly on each job card, not only when clicking "Send" to open the edit dialog.

### Changes

**`src/components/scheduling/RouteBuilder.tsx`**

1. **Pass `profileOpeningHours` to `JobItem`** — Add `openingHours` prop to the `JobItemProps` interface and pass `profileOpeningHours[job.orderData?.user_id]` from both drawer and dialog render locations.

2. **Add opening hours badge logic** — Create a helper function `getOpeningHoursBadge(estimatedTime, selectedDate, openingHours)` that:
   - Returns `null` if no opening hours data exists
   - Returns a red "Closed" badge if the business is closed on that day
   - Returns an amber "Outside Hours" badge if the estimated time is before `start` or after `end`
   - Returns `null` (no badge) if within hours or 24h

3. **Render the badge on each job card** — Add the opening hours badge in the badges row for both single and grouped job views, next to the existing availability/collection/inspection badges.

### Visual Result
Each job card will show a small badge like:
- `⚠️ Closed` (red) — business is closed on selected day
- `⚠️ Outside Hours (09:00-17:00)` (amber) — estimated time is outside opening hours
- No badge when within hours or no opening hours data

