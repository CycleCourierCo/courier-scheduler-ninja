# Show Bikes Loaded onto Van in Pending Storage Allocation Section

## Status: ✅ COMPLETED

## Overview
Enhanced the Pending Storage Allocation tab to also display bikes that have been loaded onto a van but have not yet been delivered. These bikes are displayed with a different UI - showing just their details and "Loaded onto Van" status without allocation inputs or allocate buttons.

This allows tracking exactly how many bikes are in each driver's van, including those that may not get delivered on the route.

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/LoadingUnloadingPage.tsx` | Added `bikesLoadedOntoVan` filter and passed to PendingStorageAllocation |
| `src/components/loading/PendingStorageAllocation.tsx` | Accepts new prop and renders loaded bikes with simplified UI |

## Implementation Summary

### LoadingUnloadingPage.tsx
- Added `bikesLoadedOntoVan` filter: orders where `loaded_onto_van=true`, not delivered, not cancelled
- Passed as new prop to `PendingStorageAllocation` component
- Updated header text to show both pending allocation and loaded onto van counts

### PendingStorageAllocation.tsx
- Updated props interface to accept `bikesLoadedOntoVan: Order[]`
- Groups collected bikes by collection driver and loaded bikes by delivery driver
- Renders loaded bikes with:
  - Green-tinted card background
  - "Loaded onto Van" success badge
  - Bike details (sender, brand/model, receiver destination, tracking)
  - Print Label and See Image buttons
  - NO allocation inputs or allocate button
- Renders pending bikes with existing UI (allocation inputs + allocate button)
- Updated empty state message to reflect both categories
