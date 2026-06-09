# Fix: Mechanics can't see Box My Bike page

## Root cause
`src/components/ProtectedRoute.tsx` whitelists routes per restricted role. The `mechanic` role only allows `/bicycle-inspections`, so a mechanic-only user hitting `/box-my-bike` falls through the "no allowed page" branch and gets redirected to `/bicycle-inspections`. Admins are unaffected (they short-circuit earlier), which is why nobody noticed until a pure-mechanic user tried it.

## Change
In `src/components/ProtectedRoute.tsx`:

1. Add a path flag:
   ```ts
   const isBoxMyBikePage = location.pathname === '/box-my-bike';
   ```
2. Extend the `mechanic` branch of the allow-list loop:
   ```ts
   if (r === 'mechanic' && (isBicycleInspectionsPage || isBoxMyBikePage)) anyAllowed = true;
   ```

No other roles are added (the page itself already gates content on `admin` or `mechanic` via `isStaff`, and customers reach it as their own orders through the `b2c`/`b2b` default path which already renders children).

## Out of scope
- No DB/RLS changes
- No nav menu changes (mechanics already see the link via existing Layout logic if applicable)
- No changes to the page component itself
