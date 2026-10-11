# Add Ireland to the admin menu

## Why you can't see it

The Ireland page and its address (`/ireland`) exist, and mechanics, loaders and dealers already get it automatically. But the menu shown to admins is a separate hand-written list in the header component, and Ireland was never added to that list — so it only appears for the non-admin roles above.

## What to build

Add one entry, "Ireland", to the **Operations** group of the admin menu, placed just after **Trunk Runs**, using the same box icon as Box My Bike. It renders in both places the admin menu appears:

- the desktop account dropdown
- the mobile side menu

Nothing else changes: the page itself, its three tabs, and who can open it all stay as they are.

## Technical details

- `src/components/Layout.tsx` — in `ADMIN_MENU_SECTIONS`, the `Operations` item array gains `{ to: "/ireland", label: "Ireland", icon: Package2 }` after the Trunk Runs line. `Package2` is already imported in that file, so no new imports.
- The route registry (`src/config/routes.ts`) and the page (`src/pages/IrelandPage.tsx`) are untouched — the entry is menu-only.
- Admin access to `/ireland` is already allowed by the permission system (admins always have full access), so the link will open for you straight away.
