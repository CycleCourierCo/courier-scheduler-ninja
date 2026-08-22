# Add Mechanic Profitability to the admin menu

The page exists at `/mechanic-profitability` and is registered in the route registry, but the admin menu is a separate hardcoded list in `src/components/Layout.tsx` that was never updated — so admins don't see it in the desktop dropdown or the mobile sheet.

## Change

Add `Mechanic Profitability` to the Insight section of the admin menu, after `Route Profitability`, using the wrench icon (matching the registry entry).

To stop this drift happening again, derive the admin menu's Insight items from the shared route registry rather than keeping a duplicate literal for that section — or, if kept literal, add a short comment tying it to `src/config/routes.ts`.

## Technical notes

- `src/components/Layout.tsx`: add `{ to: "/mechanic-profitability", label: "Mechanic Profitability", icon: Wrench }` to `ADMIN_MENU_SECTIONS` under `Insight`. `Wrench` is already imported. Both desktop and mobile render from this array, so one edit covers both.
- No route, permission or page changes needed.
