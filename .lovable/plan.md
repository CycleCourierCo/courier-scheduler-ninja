# Shared saved routes for route planners

## Why Jabir can't see them

Saved routes are private: the database rule only lets someone see a route if they are an admin or if they saved it themselves. Jabir Hussain is a route planner (not an admin), so he only sees his own 147 saved routes and none of the 40 saved by Abdullah Admin.

## What to change

- Anyone with the route planner role (plus admins) can see every saved route, whoever saved it.
- They can also load and save routes, as now.
- Deleting stays limited to an admin or the person who saved the route, so nobody loses someone else's work by accident.
- Each route in the load list shows who saved it, so it's obvious whose plan you are opening.
- Everyone else (drivers, loaders, customers) keeps no access at all.

## Technical notes

- Replace the `saved_routes` SELECT/INSERT/UPDATE policies so they allow `admin` or `route_planner` via `has_role`, following the existing performance pattern (`EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE ...)`).
- Keep DELETE as admin-or-creator.
- Confirm grants for `authenticated` exist on the table; add them in the same migration if missing.
- In `LoadRouteDialog.tsx`, fetch the saver's name (lookup on `profiles` by `created_by`) and render it on each row; hide the delete button when the current user is neither admin nor creator.
