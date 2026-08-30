# Equipment missing from the admin menu

The Equipment page is registered in the route registry (`src/config/routes.ts`, Fleet section, `/equipment`), but the admin menu in `src/components/Layout.tsx` is a separate hardcoded list (`ADMIN_MENU_SECTIONS`) whose Fleet section has Vehicles, Driver Timeslips, Fuel Finder and Damage Claims only — no Equipment. So admins don't see it in either the desktop dropdown or the mobile sheet. Non-admin staff (loader, fleet manager) get their menu from the registry, so they already see it.

## Change

Add `Equipment` to the Fleet section of `ADMIN_MENU_SECTIONS`, first in that section, using the `Boxes` icon to match the registry entry.

## Technical notes

- `src/components/Layout.tsx`: add `{ to: "/equipment", label: "Equipment", icon: Boxes }` to the Fleet items array, and add `Boxes` to the existing lucide-react import.
- Desktop dropdown and mobile sheet both render from this array, so one edit covers both.
- No route, page or permission changes.
