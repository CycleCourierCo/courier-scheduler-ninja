## Goal
Add a map at the top of the Account Approvals page that pins every business account with a known location.

## Approach
1. Extend `get_business_accounts_for_admin` RPC return type (or just the local `BusinessAccount` interface) to include `latitude` and `longitude` from the `profiles` table — these columns already exist.
2. Create `src/components/admin/BusinessAccountsMap.tsx` using Leaflet (`react-leaflet`) — the same stack already used in `TimeslipMapPreview.tsx`, so no new deps.
   - Centers on the UK, auto-fits bounds to all pinned businesses.
   - Marker per business with a popup showing: company name, contact name, status badge text, city/postcode.
   - Color-code markers by `account_status` (pending = amber, approved = green, rejected/suspended = red) using the existing colored marker icon URLs already used in the project.
   - For businesses missing lat/lon, fall back to geocoding their postcode client-side via Geoapify (`VITE_GEOAPIFY_API_KEY` already in env) and cache results in component state so the map fills in progressively. No DB writes.
3. In `src/pages/AccountApprovals.tsx`:
   - Import and render `<BusinessAccountsMap accounts={filteredAccounts} />` above the existing Card.
   - Respects the existing status filter so the map updates when the user changes the dropdown.
4. Empty state: if no accounts have a location yet, show a muted placeholder message inside the map container (same pattern as `TimeslipMapPreview`).

## Out of scope
- No DB schema changes, no migrations.
- No backfill/storage of geocoded coordinates.
- No changes to the table, filters, or approve/reject actions.

## Files
- New: `src/components/admin/BusinessAccountsMap.tsx`
- Edit: `src/pages/AccountApprovals.tsx` (add lat/lon to interface, render map)
