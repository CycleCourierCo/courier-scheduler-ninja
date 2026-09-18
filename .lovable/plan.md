# Make the heavy pages load and stay responsive

Box My Bike, Bicycle Inspections, Loading & Storage and Job Scheduling can freeze the browser. The pages don't download too much — the live working set is about 330 orders (roughly 0.6 MB) and 325 inspections with 622 repair lines. The stalls come from the browser redoing the same heavy work over and over, plus some avoidable waiting before anything appears.

## What is actually causing it

1. **Inspections re-sorts and re-groups everything on every key press.** The page builds its ten status groups by scanning the whole list a dozen times, and it does that again on every keystroke in the search box, every time a dialog opens or closes, and on every hover. The page is also one single 3,972-line piece, so any small change redraws all of it.
2. **Inspections runs a tidy-up job before it will show anything.** Each visit first reconciles stuck inspection stages one by one, then loads orders, then inspections, then customer names, then walk-ins — five waits in a row before the first card appears.
3. **Inspections matches records the slow way.** For every order it searches the whole inspection list twice to find its match.
4. **Job Scheduling checks every job with the courier system on load.** It asks the delivery provider to verify jobs for all live orders, not just the day being planned.
5. **Route planning logs a line per job while grouping them by area,** and the grouping compares every job with every group. Each of those log lines is also captured for error reporting, which multiplies the cost.
6. **Loading & Storage loads every column of every live order,** including large tracking-history blobs it doesn't display.
7. **Any tab switch reloads everything.** There is no "data is still fresh" window, so returning to the tab from Shipday or email refetches the whole list.
8. **Printing labels blocks the whole page** while the PDF is built, which is what makes the browser warn that the page isn't responding on big collection days.

## What I'll change

- Group and count the inspections once per data change instead of on every render, and split each inspection card into its own piece so typing a comment only redraws that card. Long groups get windowed so only visible cards are built.
- Show the inspections list first and run the stage tidy-up quietly afterwards; load the independent bits at the same time rather than one after another.
- Match orders to inspections by direct lookup instead of searching the list repeatedly.
- On Job Scheduling, only verify courier jobs for the date being planned, and only when the planner asks.
- Remove the per-job logging in route grouping.
- Load only the fields Loading & Storage actually shows, dropping the tracking-history blobs.
- Give the whole app a short freshness window and stop automatic reloads on tab focus; add a manual refresh where staff need it.
- Build label PDFs in batches so the page keeps responding, with progress shown.
- Same review pass over Box My Bike and Warehouse Stock: single-pass grouping, memoised cards, trimmed fields.

Nothing about what the pages show, who can see them, or how data is saved changes.

## How I'll check it

- Measure first and after on Inspections, Box My Bike, Loading & Storage and Job Scheduling: time to first content, and the delay after a search keystroke. Target under ~1 second to content and no visible lag while typing.
- Drive the app in a headless browser to confirm no long blocking tasks and no "page unresponsive" warnings, and that the lists still show the same records and counts.

## Technical notes

- `src/pages/BicycleInspections.tsx:1581-1611`: replace the twelve chained `.filter()` passes with one `useMemo` bucketing pass; extract `renderInspectionCard` into a `React.memo` `InspectionCard` component file under `src/components/inspections/`; virtualize buckets over ~50 rows.
- `src/pages/BicycleInspections.tsx:299-311`: drop `await reconcileInspectionStatuses()` from the `queryFn`; run it after first paint and invalidate on completion.
- `src/services/inspectionService.ts:574-680`: build a `Map` keyed on `order_id`; `Promise.all` the profiles and workshop-inspection queries.
- `src/pages/JobScheduling.tsx:112-166`: scope `verifyShipdayOrders` to the selected date's orders; keep the wide select but drop `tracking_events` where unused.
- `src/services/schedulingService.ts:36-190`: remove loop `console.log` calls.
- `src/services/orderService.ts:99-127`: replace `select("*, bicycle_inspections(status)")` with an explicit column list; drop the per-call `console.log`.
- `src/App.tsx` QueryClient: `defaultOptions.queries = { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 }`.
- `src/utils/labelUtils.ts` + Dashboard bulk labels: chunk page generation with `await new Promise(r => setTimeout(r))` between batches and report progress.
- No database or edge-function changes.
