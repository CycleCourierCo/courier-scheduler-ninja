# What happens to expired jobs in route planning

## Current behaviour (verified in code)

Expired jobs are **not lost** — they are handled deliberately:

1. **Nightly check** (`expire-availability` edge function, 00:15 UK time) flags any
   leg whose customer dates have all passed as `expired` in
   `order_leg_availability`, and revives legs that get fresh dates.
2. **Every generation run re-checks expiry first** — both Balanced and Daily
   (greedy) modes exclude expired legs from the optimiser, so they can never be
   planned onto a van with dates the customer can no longer do.
3. **They are shown, not hidden**: the Generate Routes dialog has a
   **"Needs new dates"** panel listing each expired/awaiting-dates leg, ordered
   by severity (missed guaranteed date, bike held in depot, lapsed collection),
   each with **Request new dates** and **Cancel order** actions. This panel is
   shared across both planning tabs.
4. When a customer supplies fresh dates, the leg flips back to `active` and is
   included in the next generation run automatically.

So the answer to "what happens with expired jobs": they are excluded from both
planners and surfaced in the Needs-new-dates panel for re-contact — nothing
disappears silently.

## About booking expired jobs at higher priority

Booking an expired job "at higher priority" isn't possible as-is: priority only
orders jobs **inside** the optimiser, and expired legs are excluded before the
optimiser runs — because the customer's dates have passed, so any van slot we
plan them into would be a date the customer hasn't agreed to. The existing flow
is the safe equivalent: request fresh dates, and once the customer replies the
leg gets a +20 priority boost (capped at 99) so it's placed early in the next
run. If you'd rather book them anyway on a chosen date, that needs a deliberate
"plan despite lapsed dates" override — say the word and it can be added.

## Job age and priority (current state)

Priority is `60 ÷ (number of remaining dates) + 40 ÷ (days until the nearest
date)`, plus boosts for guaranteed dates and re-dated legs. There is **no
explicit age term**: an order sitting for weeks but with plenty of future dates
available ranks lower than a new order with only tomorrow free. Adding a small
age-based term (older orders get a modest boost) is included below as an
optional improvement.

## Small gaps worth closing

1. **Left-over count conflates reasons.** The per-plan "jobs left over" number
   includes expired legs mixed with jobs that simply didn't fit. Split the
   display into "didn't fit" vs "dates expired" so the comparison between
   Balanced and Daily modes isn't distorted.
2. **No panel entry until a run happens.** If the dialog is opened but Generate
   isn't pressed, expired legs aren't shown. Load the current
   `order_leg_availability` expired rows when the dialog opens so the list is
   visible before running.
3. **Age-based priority (optional).** Add a capped age term to `buildPriority`
   in `route-optimize` (e.g. +1 per full week since the order was booked,
   capped at +10) so long-waiting jobs climb the ranking without overriding
   guaranteed dates or date scarcity.

## Technical notes

- `route-optimize` already returns `needs_new_dates` (sorted by severity) on both
  joint and greedy responses; `NeedsDatesPanel` renders it in
  `GenerateRoutesDialog.tsx` (~line 657).
- For gap 1: the optimiser knows which legs were excluded for expiry vs
  unrouted — expose separate `expired_count` / `unrouted_count` per day/plan and
  show both in `DaySummary` and the comparison strip.
- For gap 2: add a lightweight fetch of `order_leg_availability` (status
  `expired`/`awaiting_new_dates`) joined to orders on dialog open, rendered by
  the same `NeedsDatesPanel`.
