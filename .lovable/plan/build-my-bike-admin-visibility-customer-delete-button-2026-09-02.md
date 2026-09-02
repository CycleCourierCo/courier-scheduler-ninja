# Build My Bike: admin visibility + customer delete button

## What's wrong now

- Staff (admin, CS, mechanic, loader) only see builds tied to the Birmingham site. The builds list is fetched with the Birmingham site filter, but all 3 existing builds in the database have no site set, so admins currently see an empty list even though the access rules already allow them to see every customer's builds.
- Every build card shows a red delete button, including for B2B customers viewing their own builds.

## Changes

1. **Admin sees all builds**
   - Staff load the builds list without any site filter, so builds for all customers appear regardless of whether a site was recorded. Customers keep seeing only their own builds (enforced by the database access rules).
   - Keep the Birmingham pinning where it matters: stock/part picking still draws from the Birmingham warehouse only.
   - Add a customer filter dropdown above the list for staff so a specific customer's builds can be isolated quickly.

2. **Hide delete from customers**
   - The trash button on each build card only renders for staff.
   - Same treatment inside the build detail dialog: removing an allocated component stays staff-only (customers shouldn't be able to release reserved stock).
   - Stored build templates: customers keep the ability to delete their own stored builds unless you want that hidden too — say the word and I'll gate it the same way.

## Technical notes

- `src/pages/BuildMyBikePage.tsx`: pass `null` as the site argument to `getBikeBuilds` for staff (keep `activeSiteId` for stock lookups), add a `customerFilter` state applied in the existing `filtered` memo, and wrap the card's `Trash2` button in `isStaff &&`.
- `src/components/build-my-bike/BuildDetailDialog.tsx`: gate the component-row remove button behind the existing `isStaff` prop.
- No database or policy changes needed — `bike_builds_staff_all` already grants staff full visibility.
