
# Limit Availability Calendar to 1 Month from Today

## What Changes
In the availability calendar (used by both sender and receiver availability pages), add a maximum selectable date of **1 month from today**. Currently, users can scroll indefinitely into the future -- this change restricts selection to the next 30 days only.

## Technical Details

**File: `src/components/availability/AvailabilityForm.tsx`**
- Import `addMonths` from `date-fns`
- Add a `toDate` prop to the `CalendarComponent`, set to `addMonths(today, 1)`
- This prevents users from navigating past or selecting dates beyond 1 month from today

The change is a single line addition to the calendar component:
```tsx
toDate={addMonths(today, 1)}
```

No changes needed to the hook, service layer, or any other components -- the calendar component handles the restriction natively via the `toDate` prop from `react-day-picker`.
