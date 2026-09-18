# Why Sunday was possible — and Northern Ireland weekday-only collection

## What happened

That order's collection day is saved as Sunday 20 September. The date rules on the customer availability calendar only block:

- days in the past
- Fridays (unless that Friday is on the allowed-Fridays list)
- holidays you've added

Saturdays and Sundays were never blocked, so the Northern Ireland single-day picker offered Sunday and accepted it.

## Change

For inbound Northern Ireland collections (the single-day picker), the customer can choose any weekday, Monday to Friday:

- Saturday and Sunday are not selectable, and are rejected if they somehow arrive with a submission.
- Friday is selectable for these Northern Ireland collections, since the ferry partner books weekdays — the usual Friday restriction and allowed-Fridays list stops applying here.
- Holidays and past dates stay blocked, and the two-week limit stays.

Everything else is untouched: the normal 7-day collection and delivery calendars keep today's rules exactly as they are.

This order still needs its day changed by hand — the plan doesn't move existing dates.

## Technical notes

- `src/hooks/useAvailability.tsx`: `isDateDisabled` becomes aware of the single-day mode (`requiredDates === 1`). In that mode: block `getDay() === 0 || getDay() === 6`, skip the Friday/allowed-Fridays branch, keep past-date and holiday checks. In normal mode behaviour is unchanged. Apply the same weekday test in the `handleSubmit` pre-filter for the single-day path, and adjust the "invalid date" warning wording to mention weekends.
- `calendarEndDate` already runs through `isDateDisabled`, so the single-day two-week window needs no change.
- `src/components/availability/AvailabilityForm.tsx`: fallback `defaultIsDateDisabled` is only used when no custom function is passed; leave it as-is.
- No database, RLS or edge function changes; `set_order_availability` keeps storing `YYYY-MM-DD` strings.
- Verify with `npx tsgo --noEmit` and `bun run build`.
