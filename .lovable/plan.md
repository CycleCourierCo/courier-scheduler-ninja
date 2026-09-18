# Fix "Failed to save route: invalid input syntax for type integer: 9.5"

## What's happening

Van space weighting lets a bike count as half a space (e.g. 9.5 spaces of starting van load). The saved-route record still stores the starting van load as a whole number only, so any route with a half space is rejected and nothing saves.

## The fix

Allow fractional starting van load on saved routes, so 9.5 saves as 9.5.

1. Change the saved route's starting van load field to accept decimals (keeps all existing whole-number values as they are).
2. Leave the route builder maths untouched — it already works in half spaces and displays them correctly.
3. Re-save and re-load a route with a half space to confirm the value round-trips.

## Technical detail

- Migration: `ALTER TABLE public.saved_routes ALTER COLUMN starting_bikes TYPE numeric;` (existing integers cast cleanly; no data loss).
- `saved_routes.starting_bikes` is written in `SaveRouteDialog.tsx` and `RouteBuilder.tsx` and read in `LoadRouteDialog.tsx`; all already treat it as `number`, so no code change is needed once the column is numeric. Supabase types regenerate after the migration.
