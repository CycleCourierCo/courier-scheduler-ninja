# Why Sunday was possible — and stopping it

## What happened

That order's collection day is saved as Sunday 20 September. The date rules on the customer availability calendar only block:

- days in the past
- Fridays (unless that Friday is on the allowed-Fridays list)
- holidays you've added

Saturdays and Sundays were never blocked, so the Northern Ireland single-day picker happily offered Sunday and accepted it. The same is true of the normal 7-day sender and receiver calendars.

## Change

Treat Saturday and Sunday like Friday: not selectable on any customer availability calendar (collection and delivery, single-day NI and the usual multi-day windows), and rejected if they somehow arrive with a submission.

Because weekends and Fridays drop out, the calendar keeps stretching far enough ahead to still offer a full set of choosable days, and the NI single-day picker keeps its two-week limit.

If a weekend day gets stripped from a selection, the customer sees the existing "invalid date(s) were removed" warning, updated to mention weekends.

This order still needs its day changed by hand — the plan doesn't move existing dates.

## Technical notes

- `src/hooks/useAvailability.tsx`: extend `isDateDisabled` to return true for `getDay() === 0 || getDay() === 6`; apply the same test in the `handleSubmit` pre-filter; leave the allowed-Fridays exception as-is. The `calendarEndDate` loop already uses `isDateDisabled`, so the 14-selectable-day window self-corrects.
- `src/components/availability/AvailabilityForm.tsx`: mirror the rule in `defaultIsDateDisabled` (fallback path only).
- `src/pages/BulkAvailabilityPage.tsx`: check its date guard and add the same weekend rule so bulk entry can't reintroduce weekends.
- No database, RLS or edge function changes; `set_order_availability` keeps storing `YYYY-MM-DD` strings.
- Verify with `npx tsgo --noEmit` and `bun run build`.
