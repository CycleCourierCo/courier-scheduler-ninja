# Tie workplace hours to the chosen dates, and add address search

## What changes for the customer

1. **No more "days & times at home"** — they only tell us when they're at work. Everything outside that is treated as home, automatically.
2. **Work hours link to the calendar dates they picked.** Instead of picking weekdays (Mon–Thu) that may not match their availability, the selected dates appear as a list. Each date has a simple choice:
   - At home all day (default)
   - At work between two times (e.g. 09:00–17:00)
   A "Apply these times to all dates" shortcut fills the rest in one tap.
3. **Address search on the workplace address** — same Geoapify autocomplete used when creating an order. Typing shows suggestions; picking one auto-fills address line, town/city, postcode, and the lat/long behind the scenes, so the manual "Check address" step disappears.

If they change their selected dates afterwards, the work-hours list follows: newly added dates appear (defaulting to home), removed dates drop out.

## Technical notes

- `src/lib/altLocation.ts`
  - Add a date-keyed work window shape: `work_dates?: Record<string /* YYYY-MM-DD */, { start: string; end: string }>`.
  - Keep `AltWindow`/`work_windows` parsing for backwards compatibility with already-submitted orders, but stop writing `home_windows`.
  - `resolveStopAddress` first looks up `work_dates[YYYY-MM-DD]` for the stop date and returns work when the arrival time falls inside it; falls back to the legacy weekday `work_windows` for old records, otherwise home.
- `src/components/availability/AltLocationFields.tsx`
  - Accept a new `dates: Date[]` prop; render one row per selected date with a home/work toggle plus time inputs, and an "apply to all" action.
  - Remove the home-windows block and the `DayToggles` usage.
  - Replace the manual street/city/postcode inputs + "Check address" button with a Geoapify autocomplete input mirroring `src/components/AddressForm.tsx` (`/v1/geocode/autocomplete`, `filter=countrycode:gb`, debounced at 3+ chars), writing street/city/postcode/lat/lon into `work_address`. Keep the individual fields visible (read-only-ish, still editable) after a pick.
- `src/components/availability/AvailabilityForm.tsx` — pass `dates` through to `AltLocationFields`.
- No database migration needed; `sender_alt_location` / `receiver_alt_location` are JSONB.
- Scheduling side (`RouteBuilder.tsx` and notification/Shipday paths) already goes through `resolveStopAddress`, so it picks up the date-keyed logic with no further change.
