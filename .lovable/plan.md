# Remove AI Routing and Dispatch pages

Delete the AI Routing, Dispatch Orders and Dispatch Routes pages from the portal, along with the code, background helpers and stored data behind them. The existing Route Builder / Job Scheduling planner stays exactly as it is.

## What changes for users

- The Operations menu loses "AI Routing", "Dispatch Orders" and "Dispatch Routes" (mobile menu and dropdowns too).
- Those addresses no longer open anything; anyone visiting them lands on the not-found page.
- Route permission settings no longer list those three pages.
- Saved routes, the Route Builder, job scheduling, timeslips and loading lists are untouched.

## Files removed

- `src/pages/AIRouting.tsx`, `src/pages/DispatchOrdersPage.tsx`, `src/pages/DispatchRoutesPage.tsx`
- `src/components/ai-routing/` (all 7 components)
- `src/services/routeOptimizationService.ts` (only used by AI Routing)
- `docs/AI_ROUTE_PREDICTION.md`

## Files edited

- `src/App.tsx` — drop the three imports and the three `<Route>` entries.
- `src/components/Layout.tsx` — remove the three nav items and the two `/ai-routing` links.
- `src/config/routes.ts` — remove the `ai-routing`, `dispatch-orders`, `dispatch-routes` entries (and now-unused icon imports).

## Edge functions deleted

`predict-routes-v2`, `build-route-archetypes`, `build-historical-routes`, `build-postcode-patterns`, `optimise-route` — each is only called by the removed pages. Their folders are deleted, their `[functions.*]` blocks removed from `supabase/config.toml`, and they are removed from the live project.

## Database dropped

No scheduled jobs reference this feature (checked `cron.job`), so there is nothing to unschedule.

One migration drops, in dependency order:

- `dispatch_route_stops`, `dispatch_routes`
- `route_predictions`, `route_prediction_runs`, `route_group_scores`, `planner_route_overrides`
- `route_archetype_members`, `route_archetypes`
- `historical_route_stops`, `historical_routes`
- `postcode_patterns`
- the legacy `routes` table (no code references it)

Plus a data cleanup removing `role_route_permissions` rows for the three removed page keys.

This permanently deletes any stored dispatch routes and learned route patterns. `saved_routes` is kept — Route Builder uses it.

## Verification

Typecheck with `npx tsgo --noEmit -p tsconfig.app.json`, then confirm no remaining references to the removed pages, components, service, functions or tables.
