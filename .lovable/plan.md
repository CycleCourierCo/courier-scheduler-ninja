## Goal
On the Bicycle Inspections page, for bikes that have been collected by a driver but not yet allocated to a storage bay, show which driver's van the bike is currently in.

## Where it shows
The inspection card in the **Collected** tab (bikes with `collection_confirmation_sent_at` set, awaiting inspection). If the order also has no `storage_locations` (i.e. not yet allocated to a bay), render a small badge like:

> 🚐 In {DriverName}'s van

If `storage_locations` exists, no badge (it's already in a bay). If we can't resolve a driver name, no badge.

## Technical details

1. **`src/services/inspectionService.ts` — `getPendingInspections`**
   - Add `tracking_events` to the `orders` select so we have the Shipday updates needed to resolve the pickup driver.

2. **`src/pages/BicycleInspections.tsx` — `renderInspectionCard`**
   - Import `getDriverAssignment` from `@/utils/driverAssignmentUtils`.
   - Compute `pickupDriver = getDriverAssignment(order as any, 'pickup')`.
   - Compute `hasAllocation = Array.isArray(order.storage_locations) ? order.storage_locations.length > 0 : !!order.storage_locations`.
   - When `!hasAllocation && !!order.collection_confirmation_sent_at && pickupDriver`, render a `Badge` (with a small van/truck icon) next to the existing status/meta badges near the top of the card.

No changes to data model, RLS, or other tabs.