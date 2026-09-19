# Homepage coverage line + top bar tweaks

Small presentation-only changes. No business logic, permissions, or data changes.

## 1. Show "England, Wales and Northern Ireland" on the homepage

`src/pages/Index.tsx` (hero section):
- Add a coverage line in the hero under the subheading, styled as a small uppercase line with a MapPin-style icon, e.g. "Serving England, Wales and Northern Ireland" — visible on mobile and desktop.
- Also update the first feature bullet's description from "across the UK and Ireland" to "across England, Wales and Northern Ireland" so the copy matches.

## 2. Remove the Home button from the top bar

`src/components/Layout.tsx`:
- Delete the "Home" link from `navLinks` (it renders in both the desktop top bar and the mobile menu sheet, so removing it there removes it everywhere in the bar).
- The van icon logo already links to the homepage, so users can still get back to the homepage by tapping the logo.
- Remove the now-unused `Home` icon import if nothing else uses it (note: the "Dashboard" menu item also uses `Home` icon — keep the import if so).

## 3. Mobile top bar shows "Cycle Courier Co" next to the van icon

`src/components/Layout.tsx` header:
- The brand text `<span>CYCLE COURIER CO.</span>` is currently hidden on small screens (`hidden ... sm:block`). Make it always visible so on mobile it appears alongside the van icon.
- Use a slightly smaller size on mobile if needed so the icon + text + menu button fit at 393px width.

## Verification

- Run the production build.
- Playwright at mobile (393px) and desktop widths: homepage shows the coverage line, top bar has no Home link, mobile header shows van icon + "CYCLE COURIER CO." with no overflow.
