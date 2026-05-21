# Show the person icon dropdown on mobile too

## Problem

On mobile, the top bar only shows the theme toggle and a hamburger menu (lines 85–94 of `src/components/Layout.tsx`). The person icon avatar dropdown lives inside `hidden md:flex` (line 282), so it only renders from the `md` breakpoint up. Users on phones never see it — which is why jnh096506 sees no person icon at all.

## Fix (UI-only, `src/components/Layout.tsx`)

1. In the mobile top-bar container (`<div className="flex items-center space-x-2 md:hidden">`, line 85), add the same person-icon `DropdownMenu` block that desktop uses (currently lines 285–544), placed between `ThemeToggle` and the hamburger `Sheet`.
2. Use the existing gate `{user && <DropdownMenu>…}` so every signed-in user sees the icon, with each role section inside rendered independently (admin/sales/B2B/route_planner/driver/mechanic — same additive structure as desktop).
3. To avoid duplicating ~260 lines of JSX, extract the dropdown body into a small local variable (e.g. `const userMenu = user ? <DropdownMenu>…</DropdownMenu> : null;`) inside the component and render `{userMenu}` in both the mobile container (line 85 block) and the desktop container (line 282 block).
4. No changes to the hamburger sheet, role logic, routing, or RLS. The sheet keeps working as-is; the person icon is simply also surfaced on mobile.

## Result

- Mobile: theme toggle, person icon (full dropdown), hamburger — all visible for any signed-in user.
- Desktop: unchanged.
- Pure loader / mechanic accounts still get the icon (they're signed in); the dropdown shows only the items their roles entitle them to plus Logout.
