# Regression safety net, then dead-code cleanup

The project currently has **no test setup at all** (no vitest, no test files, no Playwright). So before deleting anything, we build a safety net that fails loudly if behaviour changes.

## Phase 1 — Static guarantees (fast, catches most deletion mistakes)

1. **Vitest + React Testing Library + jsdom** installed, with `vitest.config.ts`, `src/test/setup.ts`, and a `test` script.
2. **Strict typecheck gate** — `tsgo`/`tsc --noEmit` run after every deletion batch. This alone catches any removed import, export, prop or type that is still used.
3. **Knip** (unused-export/file/dependency detector) added as a dev dependency and run as the source of truth for "is this really unused", instead of hand-rolled greps. Its report is reviewed by a human before any delete, and it also guards against future dead code.
4. **ESLint tightened** for `no-unused-vars` / `no-unreachable` so new dead code is flagged at lint time.

## Phase 2 — Behaviour snapshot before deleting

5. **Route smoke tests** — one test per route in `App.tsx` that renders the page inside providers (router, react-query, auth mock, Supabase client mocked) and asserts it mounts without throwing. This is the single highest-value guard: if a deletion breaks a page, a route test fails.
6. **Unit tests on business logic** that must not change — the pure functions where regressions would be silent and expensive:
   - `src/lib/labourPricing.ts` price formula
   - `src/utils/niDelivery.ts`, `northernIreland.ts` (NI classification, ferry coords)
   - `src/utils/servicingGate.ts`, `jobUtils.ts`, `timeslotUtils.ts`, `bikeSummary.ts`, `labelUtils.ts`
   - analytics/profitability aggregators (`profitabilityService`, `mechanicProfitabilityService`, `apiWebhookAnalyticsService`, `driverAnalyticsService`) — fed fixed fixtures, asserting exact numbers
7. **Playwright visual/flow checks** against the running preview for the highest-traffic screens (Dashboard, Order detail, Job scheduling, Analytics tabs, Tracking, Inspections): screenshot each, assert no console errors. Screenshots taken **before** cleanup become the baseline compared after.
8. **Edge function tests** — Deno tests per function for pure helpers (status mapping, payload building, NI/foam transitions), run with the edge-function test tool. No live webhook calls.

## Phase 3 — Cleanup under the net

9. Delete in small batches (deps → unused shadcn primitives → unused imports/vars → dead branches → commented-out code → edge-function dead code).
10. After **each** batch: typecheck, `vitest run`, Playwright screenshots vs baseline, edge function tests. Any red = revert that batch.
11. Ambiguous files are **listed, not deleted** (as agreed): the legacy scheduling dialog set, timeslip map preview, `OrderTimeChart`, `dashboardUtils`, `logger`.

## Honest limits

- Tests catch what they cover; the route smoke tests plus typecheck cover the "page still works" case well, but a rarely-used button inside a page can still be missed. That's why nothing ambiguous gets deleted.
- Anything reached only via cron, webhooks or external API callers is invisible to static analysis — no edge function directory will be removed, only dead code inside them.
- Runtime-dynamic references (string-built paths, `import()` by variable) are searched for explicitly before each delete.

## Suggested order

Phase 1 + 2 first as a standalone change (no deletions), so the baseline is captured against today's known-good app. Then Phase 3 in follow-up batches.
