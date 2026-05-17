## Problem

`src/components/Layout.tsx` hides nav and menus whenever `isLoader` or `isMechanic` is true:

- Line 35: `const navLinks = !isLoader && !isMechanic ? <>…</> : null;`
- Line 96 (mobile sheet): wraps the entire admin/sales/B2B/route_planner section in `user && !isLoader && !isMechanic`.
- Line 307 (desktop dropdown trigger): `user && !isLoader && !isMechanic && <DropdownMenu>…`
- Mobile sheet also has three mutually-exclusive `{user && isDriver}`, `{user && isLoader}`, `{user && isMechanic}` branches that duplicate items and don't combine.

`jnh096506@gmail.com` has multiple roles including loader and/or mechanic, so these checks hide his entire nav even though he is also (e.g.) an admin / route_planner.

`getRoles(profile)` already returns the full `roles` array from `user_roles` (see `src/lib/roles.ts` + `AuthContext.tsx`), so the data is correct — only the UI gating is wrong.

## Fix (UI-only, `src/components/Layout.tsx`)

1. Add a small helper at the top of the component:
   ```ts
   const onlyLoaderOrMechanic =
     (isLoader || isMechanic) && !isAdmin && !isRoutePlanner && !isSales && !isB2B && !isDriver
     && !hasRole(userProfile, 'b2c_customer');
   ```
   Treat it as "user has no other responsibilities".

2. **Public nav links** (line 35): render whenever `!onlyLoaderOrMechanic`. Pure loader/mechanic accounts still get nothing (current behaviour); mixed-role users get the standard Home / Track / Create / Bulk Upload links again.

3. **Desktop dropdown** (line 307): change gate to just `user && <DropdownMenu>`. Each role section inside (`isAdmin`, `isSales`, `isB2B`, `isRoutePlanner`, `isDriver`, `isMechanic`, etc.) is already additive — they'll all render based on the roles the user actually has. Keep the existing `!isDriver` guard on Dashboard / Fuel Finder so pure driver UX is unchanged, but for a user with driver + admin the admin section will still show those entries.

4. **Mobile sheet menu**: collapse the three exclusive branches (`user && !isLoader && !isMechanic`, `user && isDriver`, `user && isLoader`, `user && isMechanic`) into one `{user && (…)}` block that mirrors the desktop dropdown's additive structure:
   - Always show Profile and Dashboard/Fuel Finder (with the existing `!isDriver` rule).
   - Render each role section independently: admin block when `isAdmin`, sales block when `isSales`, B2B block when `isB2B`, route_planner block when `isRoutePlanner`, driver block when `isDriver`, mechanic block when `isMechanic`. (Loader has no extra items beyond logout — fine.)
   - Render the Logout button exactly once at the end.
   - This removes the duplicated "My Timeslips" / "Bicycle Inspections" / "Logout" blocks that currently appear only when the user has _only_ that role.

5. No changes to routing/guards/RLS — `ProtectedRoute` already enforces access per route, so the nav can safely expose links the user is entitled to.

## Notes

- No backend / Supabase changes.
- No new components; only conditional-rendering changes inside `src/components/Layout.tsx`.
- Public marketing pages (when `!user`) are unaffected.
