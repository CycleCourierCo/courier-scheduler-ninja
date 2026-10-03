# Include expired-date jobs in route generation by default

## What's happening

Jobs whose customer dates have all passed (like easbs9 and chrm11) are excluded from
Generate Routes unless you press the **"Include expired jobs (n)"** button first. That
button resets to off every time the dialog opens, so a run near Bristol skipped them
silently even though they were right on the route.

## The change

Expired jobs are included automatically — no button press needed:

- The "Include expired jobs" switch starts **on** every time the dialog opens, so a
  normal run plans expired jobs alongside everything else. You can still switch it off
  for a run if you deliberately want to leave them out.
- Included expired jobs keep their existing behaviour: a priority boost so they're
  planned ahead of ordinary work, their lapsed dates treated as usable windows (they
  can land on any planned day), and they stay listed in the **Needs new dates** panel
  so it's obvious the customer hasn't confirmed anything.
- The day summary keeps showing how many planned jobs had lapsed dates.

## Technical notes

- `src/components/scheduling/generate/GenerateRoutesDialog.tsx`: change
  `useState(false)` to `useState(true)` for `includeExpired`, and reset it to `true`
  whenever the dialog re-opens / dates change if there's a reset effect. Button label
  wording updated to "Excluding expired jobs" / "Include expired jobs" so the off state
  is the explicit choice.
- No edge function change needed — `route-optimize` already honours
  `include_expired: true` with the priority boost and lapsed-date windows.

## Verification

- TypeScript check passes; build OK.
- Confirm in the dialog that the button shows as on by default and a run includes
  expired jobs near the route.
