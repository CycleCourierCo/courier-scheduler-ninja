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

## Include expired jobs — override button (new)

A per-run override so lapsed jobs can be planned anyway when the dispatcher
chooses to:

- **Button** in the Generate Routes dialog beside **Check dates**:
  **"Include expired jobs (n)"** with the count of expired/awaiting legs. It
  applies to that generation run only and is offered separately for Balanced
  and Daily tabs (each tab's setup controls already hold its own settings).
- When on, `route-optimize` receives `include_expired: true` and stops
  excluding expired legs. Each included leg gets a **+20 priority boost**
  (capped at 99) so it is planned ahead of ordinary work, and its lapsed dates
  are used as normal time windows — meaning it can land on any chosen day.
- Included jobs stay flagged: the Needs-new-dates panel keeps listing them, and
  the day summary counts them under a "lapsed dates" line so it's obvious the
  customer hasn't confirmed those dates.
- The nightly `expire-availability` check is untouched — the override never
  changes a leg's stored status, so if the run isn't used the job returns to the
  normal expired flow. If the job can't fit even with the override, it stays in
  the left-over count with reason "dates expired".

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
