# Give sales role access to the Announcements page

Currently `/emails` (Announcements) is admin-only. Sales users should also see and use it.

## Changes

1. **`src/App.tsx`** — `/emails` route: swap `adminOnly={true}` for `noB2CAccess={true}`. Combined with the restricted-roles block in `ProtectedRoute` (which already gates loader/mechanic/route_planner/driver/sales), this leaves access open to admin and sales while still blocking pure B2C and the other restricted roles.

2. **`src/components/ProtectedRoute.tsx`** — line 98: add `isEmailsPage = location.pathname === '/emails'` and include it in the sales allow-list so a pure-sales user can reach `/emails`. Admin already short-circuits at line 65.

3. **`src/components/Layout.tsx`** — surface the "Announcement Emails" nav link to sales as well:
   - Mobile sheet (line 188): wrap that single `<Link to="/emails">` with `{(isAdmin || isSales) && …}` so it renders even when the user isn't admin.
   - Desktop dropdown (line 427 `DropdownMenuItem`): same — wrap with `{(isAdmin || isSales) && …}`.
   - Leave the surrounding admin-only blocks untouched (Holidays, Notice Bars, Sentry test button stay admin-only).

## Result

- Admin: unchanged.
- Sales: can navigate to and use `/emails`.
- B2B / B2C / driver / loader / mechanic / route_planner: still blocked.
- No backend / RLS changes.
