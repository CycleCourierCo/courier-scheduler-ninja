# Fix expired-date jobs in route generation and the Expiring Dates page

## What's wrong

1. **Expired jobs are skipped by Generate Routes** unless you press "Include expired
   jobs" first — and that button resets to off every time the dialog opens, so a run
   near Bristol silently skipped easbs9 and chrm11.
2. **The button's count is wrong** — it shows every job in the Needs-new-dates list
   (71: expired + never gave dates + missed guarantees), not just the actually-expired
   ones (23).
3. **Expiring Dates page puts expired jobs in the wrong column** — the "Last date in
   2–3 days" check runs before the expired check, so anything overdue lands there
   instead of the Expired column.
4. **Northern Ireland jobs appear in the Expiring Dates columns** — they shouldn't,
   since NI work is never route-planned from the depot.

## The changes

**1. Expired jobs included by default**
- The "Include expired jobs" switch starts **on** each time the dialog opens. You can
  still switch it off for a run if you deliberately want to leave them out.
- Included expired jobs keep their existing behaviour: priority boost, lapsed dates
  usable as windows, still listed in Needs new dates.

**2. Honest button count**
- The button counts only legs whose dates have actually expired (date_state
  `expired`), not never-dated or missed-guarantee jobs. Label stays accurate in both
  states ("Including 23 expired jobs" / "Include expired jobs (23)").

**3. Correct column on Expiring Dates**
- Expired check runs first: days-overdue jobs go to **Expired**, then today, tomorrow,
  and 2–3 days. No other behaviour changes.

**4. Northern Ireland excluded from Expiring Dates**
- A leg is hidden from the page (columns and map) when either the collection or the
  delivery address is in Northern Ireland, using the existing region/BT-postcode
  detection.

## Technical notes

- `src/components/scheduling/generate/GenerateRoutesDialog.tsx`:
  - `includeExpired` state defaults to `true` (and resets to `true` on dialog open if
    a reset effect exists).
  - Add `expiredCount = needsDates.filter((l) => l.date_state === 'expired' || l.status === 'expired').length`
    and use it for the button label/count; hide the button when it's 0.
- `src/pages/ExpiringDatesPage.tsx`:
  - Column grouping: `daysLeft < 0 → Expired`, `=== 0 → today`, `=== 1 → tomorrow`,
    `<= 3 → 2–3 days`.
  - In `consider`, skip the leg when `isNorthernIrelandAddress(sender?.address)` or
    `isNorthernIrelandAddress(receiver?.address)` (either end NI excludes the order),
    importing from `src/utils/northernIreland.ts`.
- No edge function change needed — `route-optimize` already honours
  `include_expired: true`.

## Verification

- TypeScript check passes; build OK.
- Dialog opens with the toggle on and a count matching actually-expired jobs only.
- Expiring Dates page shows overdue jobs in Expired and no BT-postcode jobs anywhere.
