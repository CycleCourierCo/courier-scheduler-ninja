## Add Route Links to Create Timeslip Dialog

Extend the manual timeslip creation dialog so admins can attach one or more route links when creating a timeslip.

### Changes

**`src/components/timeslips/CreateTimeslipDialog.tsx`**
- Add `routeLinks: string[]` and `newRouteLink: string` to component state.
- Add a "Route Links" section in the form (placed near Custom Add-Ons), mirroring that pattern:
  - Text input for a URL + "Add" button.
  - List of added links shown as chips/rows with a remove (×) button each.
  - Basic URL validation (non-empty, trims whitespace; ignore duplicates).
- Include `route_links: routeLinks` in the payload passed to `createTimeslip`.
- Reset `routeLinks` on dialog close/submit.

**`src/services/timeslipService.ts`**
- Update `createTimeslip` to accept and persist `route_links` (string[]) on the insert payload. Default to `[]` if not provided.

### Notes
- No DB migration needed — `route_links` already exists on `timeslips` as a string array.
- No changes to the timeslips listing/detail UI; existing render logic already handles `route_links`.
