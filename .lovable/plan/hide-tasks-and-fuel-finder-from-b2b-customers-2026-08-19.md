# Hide Tasks and Fuel Finder from B2B customers

B2B customers currently see "Tasks" and "Fuel Finder" links in the navigation menus. Fuel Finder is already blocked at the route level for B2B-only accounts, but the link is still shown; Tasks is neither hidden nor blocked.

## Changes

### Navigation (src/components/Layout.tsx)
- Desktop account dropdown: only show the "Fuel Finder" item and the "Tasks" item for internal staff (the existing `isInternalStaff` flag), instead of the current `!isDriver` / always-on conditions.
- Mobile sheet menu: apply the same gating to its "Fuel Finder" and "Tasks" links.
- Leave the driver-specific Fuel Finder link and the loader/mechanic "My Tasks" nav link untouched.

### Route guard (src/components/ProtectedRoute.tsx)
- Add `/tasks` (including sub-paths) to the existing B2B-only blocked-path list so direct URL access redirects to the dashboard, matching how `/fuel-finder` already behaves.

No changes to task data, permissions, or the Tasks page itself.
