# Dead code audit and cleanup

Goal: remove genuinely dead code without any change to functionality or UI. Anything ambiguous gets reported, not deleted.

## Confirmed so far (verified by scanning all 360 files in `src/`)

Unreferenced UI primitives — safe to delete (approved):

- `src/components/ui/breadcrumb.tsx`
- `src/components/ui/carousel.tsx`
- `src/components/ui/pagination.tsx`
- `src/components/ui/resizable.tsx`
- `src/components/ui/sidebar.tsx`

Dependencies with no reference anywhere in `src/`, `index.html`, or config:

- `@types/dompurify` (obsolete — `dompurify` ships its own types)
- `@types/leaflet` (only if no leaflet usage is found; will re-check the heat map first)
- `@vercel/analytics`

## What gets cleaned

1. **Unused files** — delete only files with zero static references and no dynamic-import or route reference.
2. **Unused imports / variables / exported helpers** — per-file removal where the symbol is provably unreferenced across `src/` and `supabase/functions/`.
3. **Dead code paths** — unreachable branches, conditions that can never be true, leftover feature flags that are hardcoded.
4. **Commented-out code and obsolete comments** — remove commented-out blocks; keep explanatory comments.
5. **Duplicate functionality** — where two helpers do the same thing, keep one and re-point call sites (no behaviour change).
6. **Edge functions** — audit `supabase/functions/` for unused helpers, dead branches and commented-out code. No function directory is deleted, since webhooks, cron jobs and external integrations call them by URL and are not statically visible.

## Explicitly NOT deleted (reported instead, per your choice)

These have no static importer but look like parked or legacy features:

- `src/components/scheduling/DualSchedulingForm.tsx`, `SchedulingDialog.tsx`, `SchedulingCalendar.tsx`, `SchedulingGroupList.tsx`, `SchedulingStats.tsx`, `JobMap.tsx`, `MultiJobTimeslotDialog.tsx` — the old scheduling flow; `MultiJobTimeslotDialog` was edited recently, so its dialog may have been superseded by the Route Builder version.
- `src/components/timeslips/DriverManagementDialog.tsx`, `TimeslipMapPreview.tsx`
- `src/components/analytics/OrderTimeChart.tsx`
- `src/utils/dashboardUtils.ts`
- `src/utils/logger.ts` (Sentry wrapper, only referenced by itself)

Also untouched: `src/integrations/supabase/types.ts` (generated), migrations, and anything reachable from `App.tsx` routes.

## Safety approach

- Every deletion is preceded by a repo-wide search for the symbol/filename, including dynamic `import()`, string-based references, and edge-function code.
- Typecheck after each batch; build must stay clean.
- Batched in this order: unused deps → unused UI primitives → unused imports/vars → dead branches → commented-out code → edge functions.

## Deliverable

A summary listing exactly what was removed, grouped by category, plus the flagged list above with a short note on why each was left in place.
