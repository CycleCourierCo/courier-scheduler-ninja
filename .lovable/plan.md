# Search bar for Box My Bike and Foam My Bike

Add a single search input at the top of each section that filters the cards shown, live as you type.

## What it does

- Box My Bike page (`/box-my-bike`): a search box above the stage tabs filters the Box My Bike orders.
- Foam My Bike section (same page, NI tab): its own search box above its stage tabs.
- Matching fields (case-insensitive, partial match): tracking number, order id, sender name, receiver name, bike brand/model, receiver postcode/city/street, and storage bay location.
- Stage tab counts update to reflect the filtered results, so an empty stage reads "No bikes in this stage".
- Works for both staff (tabbed view) and customers (flat list view).
- Clear button (x) inside the input to reset.

## Technical notes

- Client-side filter only; no query or data-fetching changes. Both components already hold the full order list in memory.
- `src/pages/BoxMyBikePage.tsx`: add a `search` state, derive a `filteredOrders` memo, and feed it into the existing `grouped` memo instead of `orders`.
- `src/components/boxmybike/FoamMyBikeSection.tsx`: same pattern — `search` state, `filteredOrders` memo feeding `grouped` and the non-staff list.
- Use the existing `Input` component with a `Search` lucide icon; mobile-safe full-width layout.
- No backend, schema, or business-logic changes.
