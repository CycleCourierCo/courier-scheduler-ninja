# Limit availability calendars to the next 14 selectable days

## Goal

Both the sender and receiver availability pages currently open up a window that guarantees 30 selectable days. Reduce that to 14, counted as days the customer can actually pick — booked holidays and blocked Fridays don't use up any of the 14.

## Behaviour

- The calendar starts at the earliest allowed date (today for senders; the sender's earliest date, plus the inspection buffer where it applies, for receivers).
- It walks forward and counts only days that aren't holidays, aren't non-allowed Fridays, and aren't before the minimum date, stopping once 14 such days are available. That last day becomes the calendar's end date.
- Days beyond that point can't be navigated to or selected.
- Existing rules stay as they are: holidays and blocked Fridays remain greyed out, and the minimum of 7 selected dates for submission is unchanged.

## Technical notes

- `src/hooks/useAvailability.tsx`: change the `calendarEndDate` loop target from 30 to 14, and start the walk from `max(today, minDate)` so receivers get 14 selectable days after the sender window rather than 14 counted from today. Add `allowedFridayDates` to the memo dependencies so the window recalculates once Friday allowances load.
- No changes needed in `AvailabilityForm.tsx`, `SenderAvailability.tsx` or `ReceiverAvailability.tsx` — they already pass `calendarEndDate` into the calendar's `toDate`.

## Out of scope

- Bulk availability page and admin scheduling calendars.
- Changing the 7-date minimum or the holiday/Friday rules themselves.
