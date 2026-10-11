# Change the Timeslips web address to /timeslips

## What you will see

The Timeslips page opens at `.../timeslips` instead of `.../driver-timeslips`. The menu, the button in the header, and the link in timeslip emails all use the new address. Anything already saved or bookmarked at the old address still works — it opens the new page.

## What changes

- New page address: `/timeslips`.
- Old address `/driver-timeslips` redirects to `/timeslips` (no dead links from old bookmarks, chat messages or previously sent emails).
- Menu items and header links (5 places in the navigation) point at the new address.
- The "view all timeslips" link inside the generated-timeslip email is updated, and moved off the old `cyclecourier.lovable.app` address onto `booking.cyclecourierco.com`, which is what every other email in the system already uses.
- Internal design notes listing page addresses are updated to match.

## What deliberately does not change

The internal permission record for this page stays as it is. That record already holds the rules saying drivers and timeslip admins may open the page and everyone else may not, so leaving it alone means no permissions need re-approving and nothing can silently become visible to the wrong role. Only the visible web address changes.

## Technical details

- `src/App.tsx`: import `Navigate`; add `/timeslips` route with the same `ProtectedRoute` + `DriverTimeslips` element as today, and replace the current `/driver-timeslips` route with `<Navigate to="/timeslips" replace />`.
- `src/config/routes.ts`: `path: "/driver-timeslips"` becomes `path: "/timeslips"`; `key` stays `"driver-timeslips"` because `role_route_permissions.route_key` holds 10 rows against that key (driver and timeslip_admin allowed, 8 other roles explicitly denied) and `findRouteForPath` resolves access from `path` to `key`.
- `src/components/Layout.tsx`: the 5 `to="/driver-timeslips"` links (admin menu section, mobile sheet, timeslip-admin shortcut, two desktop nav entries) become `/timeslips`.
- `supabase/functions/generate-timeslips/index.ts`: email link becomes `https://booking.cyclecourierco.com/timeslips`; redeploy that function.
- `docs/REDESIGN_BRIEF.md`: page-address table rows updated.

## Verification

- Build reported clean.
- Browser check: signing in as a timeslip admin, `/timeslips` opens the page, `/driver-timeslips` lands on `/timeslips`, and the menu item highlights correctly.
- Access check: a role without permission (for example a loader) still cannot open `/timeslips`.
