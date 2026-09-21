# Generate Routes — joint multi-day planning and expired dates

Replaces the current day-by-day route generation with a single solve across all chosen days, and stops jobs with lapsed customer dates from vanishing silently.

Built in stages so each one is usable on its own.

## Stage 1 — nothing disappears silently

- Track an availability state per job leg: `active`, `expired` (every chosen date is in the past), `awaiting_new_dates`.
- A nightly check at 00:15 UK time plus the same check at the start of every generation run keeps states correct.
- Expired and awaiting legs are never sent to the optimiser.
- New "Needs new dates" panel in the Generate Routes popup and on Job Scheduling, ordered by severity:
  1. Missed guaranteed date (red) — also raises a claim record and alerts the dispatcher.
  2. Bike already at the depot with lapsed delivery dates (amber) — shows days held.
  3. Lapsed collection dates.
  4. Collection lapsed but delivery still valid — "ask for both".
- Each row has "Request new dates" and "Cancel order".
- "Validate route" button in Route Builder: sends the dispatcher's manual stop order to Verso `/plan` and shows per-stop warnings (arrives after closing, van over capacity, etc.).

## Stage 2 — one joint solve for the whole horizon

- Day picking replaces the date range: multi-select calendar, working days Sunday–Thursday by default (other days greyed but still pickable), default next 5 working days, quick picks for "Next 3 working days", "This week", "Next week".
- Van availability grid under the picker: chosen days as columns, vans as rows, all ticked by default, per-column van count. Unticked future cells are remembered.
- One optimiser call covering every van on every chosen day, with each job carrying a time window for each of its available chosen dates, so the solver chooses the best day for each job rather than filling the earliest day first.
- Long-day (15h) vehicles only exist for a van-day that can carry a hard-to-reach job; a repair loop guarantees one route per van per day.
- Second "what-if" solve adds two virtual vans a day to report shortfalls: "Short by 1 van — an extra van would plan 6 more jobs (4 urgent)", plus "vans used" and "vans spare" per day and a weekly strip.
- Collect-then-deliver across days: a second pass adds deliveries for bikes collected earlier in the plan, pinned so a collection can never land after its delivery. Inspection-required orders only unlock when `inspection_lead_days` is set.

## Stage 3 — choices, locking and re-contacting

- Per-day alternatives ("More jobs" 13h, "Shortest day" 11h) solved with the other days frozen, with plain-language trade-off notes and a warning when an alternative drops a collection that a later day's delivery depends on.
- Day states: draft, locked, confirmed. Locking a day reserves its jobs immediately; regenerating carries locked and confirmed days over untouched and re-plans only drafts. Unlocking warns when later deliveries depend on it.
- First 2 chosen days marked firm, the rest "Provisional — will change as bookings arrive"; stale banner when bookings changed since the plan was generated.
- Plan history list (generated, horizon, vans, miles, unplanned) kept read-only.
- Re-contact flow: request-new-dates link through the existing customer messaging, 48-hour reminder, escalation after two, `manual`/`auto` mode, and a +20 priority boost (capped 99) once the customer supplies new dates. Weekly expiry count reported.

## Technical notes

- Database: add `generated_at`, `firm_days`, `inspection_lead_days`, `is_stale`, `status` values `active`/`superseded` to `route_plans`; `is_provisional`, `pass`, `affects_later_legs`, `day_status` to `route_plan_routes`; a unique constraint on `(order_id, leg_type)` across locked/confirmed stops. Legs have no table today, so add `order_leg_availability (order_id, leg_type, availability_status, availability_expired_at, redate_requested_at, redate_reminders, priority_boost)` with GRANTs and staff-scoped RLS. `working_days`, `redate_mode` and horizon defaults go in `workshop_settings`. New `van_unavailability` table for remembered unticked cells.
- `supabase/functions/route-optimize/index.ts` is rewritten: vehicle IDs encoded `day_index*10000 + van_index*100 + kind`, decode map kept server-side, jobs carry `time_windows` per chosen date, `costs.fixed` for fleet consolidation, `speed_factor` 0.95 with the shortened-window fallback (12.4h / 14.3h) if Verso rejects it, two-pass precedence, repair loop up to 3 iterations, real + what-if solves, and `needs_new_dates` plus `is_provisional` added to the existing response shape. Payload-size 413 fallback: split the horizon into two overlapping halves.
- New edge functions `route-alternatives`, `route-validate` (wraps Verso `/plan`), `expire-availability` (nightly expiry + reminders, cron via the existing secret-injecting wrapper pattern).
- Frontend: `GenerateRoutesDialog.tsx` gains the multi-date picker, van grid, day columns with van counts/shortfall, alternatives cards, lock/unlock, and the needs-new-dates panel; `routeGenerationService.ts` extended with `selected_dates`, van grid, alternatives, validation and redate calls. `calculateTimeslots` in Route Builder stays the source of truth for customer times.
- Before Stage 2 goes live, benchmark the generator against 2–3 hand-planned past days (miles, hours, stops, vans) and record the result.
