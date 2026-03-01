

## Dynamically Calculate Calendar End Date to Guarantee 30 Selectable Days

**Problem**: The calendar currently shows exactly 1 month (`addMonths(today, 1)`). Holidays and Fridays reduce the number of selectable days, so users may not have enough dates to pick from.

**Solution**: Instead of a fixed 1-month window, dynamically calculate the `toDate` by counting forward from today until we find 30 selectable days (skipping Fridays and holidays). This guarantees a full month of choosable days regardless of how many are blocked.

### Changes

**1. `src/hooks/useAvailability.tsx`**
- Add a new computed value `calendarEndDate` that iterates day-by-day from today, counting days that pass the `isDateDisabled` check, until 30 selectable days are found. That final date becomes the calendar end date.
- Export `calendarEndDate` from the hook.

**2. `src/components/availability/AvailabilityForm.tsx`**
- Add a new prop `calendarEndDate: Date` to replace the hardcoded `addMonths(today, 1)` in the `toDate` prop.
- Use `calendarEndDate` as the `toDate` value on the Calendar component.
- Remove the `addMonths` import if no longer needed.

**3. `src/pages/SenderAvailability.tsx` and `src/pages/ReceiverAvailability.tsx`**
- Destructure the new `calendarEndDate` from `useAvailability` and pass it to `AvailabilityForm`.

