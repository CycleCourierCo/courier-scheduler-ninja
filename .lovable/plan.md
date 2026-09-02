# Fix Build My Bike errors and enrich My Stock

## Root cause of the build errors

The RLS policies on `bike_builds`, `bike_build_templates`, `bike_build_components`, `bike_build_stage_log` and `bike_build_template_items` all call `public.is_build_staff(uuid)`. That helper is `SECURITY DEFINER`, but `authenticated` has no `EXECUTE` privilege on it, so every policy that references it errors out for signed-in users.

Effect:
- Admin gets "Couldn't load bike builds right now" (the `bike_builds` select fails the staff policy check).
- Admin gets "Couldn't load stored builds" (same problem on `bike_build_templates`).
- B2B customer gets "Couldn't create the build" — the staff policy on `bike_builds` still evaluates for their insert, and the `EXECUTE` denial poisons the whole `USING`/`WITH CHECK` evaluation.

Fix: one-line migration granting `EXECUTE` on `public.is_build_staff(uuid)` to `authenticated`.

## Changes

1. Migration
   - `GRANT EXECUTE ON FUNCTION public.is_build_staff(uuid) TO authenticated;`

2. My Stock page (`src/pages/MyStockPage.tsx`)
   - For each stock card, show the item kind (Bike / Component) and, when it's a component, the `component_category`.
   - Use `spec` (or category) as the card title when there's no bike brand/model, so the 174 Fuvelo parts stop showing as "Item".
   - Show a small "Part" / "Bike" badge alongside status.
   - No logic changes to the query or delivery flow.

## Out of scope

No changes to Build My Bike creation flow, template UI, or warehouse stock service — the errors are purely the missing function grant.
