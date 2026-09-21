# Why "Needs new dates" shows 119 — and how to make it honest

## What the 119 actually are

The panel is not a list of expired dates. It is everything the planner could not
place because it has no usable future date, counted live at run time. Checking
the live data for active jobs:

- 95 jobs have **no delivery dates at all** (the receiver has never given
  availability) — of those, 43 have already been collected and are sitting in
  the depot.
- 21 jobs have **no collection dates at all**.
- 12 deliveries and 3 collections have dates that have genuinely **lapsed**.

Only 14 legs are actually flagged expired in the stored availability records, so
the 119 is dominated by jobs that were never given dates, not by expiries.

Two wording problems make this worse:

- Any collected bike is labelled "Bike in depot, delivery dates expired" even
  when no delivery date was ever provided. Both examples in the screenshot have
  no delivery dates at all.
- The first example says "4 days in the depot" while its collection is still
  only booked-in, because depot time is guessed from the first agreed pickup day
  rather than a real collection timestamp.

## What to change

1. **Correct the reason text.** A leg with no dates reads "No delivery dates
   given yet" / "No collection dates given yet" (adding "bike in depot" only
   when it really is collected). "Dates expired" is reserved for legs that had
   dates and they lapsed.
2. **Split the panel into groups with their own counts**, so the headline number
   stops looking like 119 expiries:
   - Waiting on first dates from the customer
   - Dates expired
   - Guaranteed date missed
   The panel title shows the total plus the expired count, e.g.
   "Needs dates (119) - 15 expired".
3. **Right action per group.** "Ask for new dates" stays for expired legs; the
   never-dated group gets "Ask for dates" (same request flow, clearer label).
4. **Only count depot days when we know the collection day.** If the bike is
   collected but no scheduled pickup day is recorded, omit the line rather than
   print a misleading number.

## Technical notes

- `supabase/functions/route-optimize/index.ts`: in the `needsNewDates` push,
  test `dates.length === 0` before the collected/in-depot case; add a
  `date_state: "never_provided" | "expired" | "guaranteed_missed"` field, and
  set `days_in_depot` only when `collectedDate` is non-null (already the case —
  the fix is to not derive it from a non-collected order's first pickup date).
  Redeploy after editing.
- `src/services/routeGenerationService.ts`: add `date_state` to
  `NeedsNewDatesLeg`, and mirror the grouping in `fetchLapsedLegs`.
- `src/components/scheduling/generate/GenerateRoutesDialog.tsx`: group the panel
  by `date_state` with per-group headings and counts; per-group button labels.
- No change to which jobs the optimiser plans — this is labelling and grouping
  only.
