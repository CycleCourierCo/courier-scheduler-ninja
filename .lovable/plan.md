# Loading lists: why nothing was going out, and fixing "- Temp van" labels

## Why the list showed only 40 coming in

The list you sent was generated for **Tuesday 15 September**. No deliveries are booked for that day yet, so there was nothing to take out of the bays or hand between drivers — everything currently sitting collected was listed as coming in.

Monday 14 September has 40 deliveries booked, 25 of them in the bays. Sending the list for Monday will show the bay pick-ups and driver hand-overs as expected.

No change is needed to how the list is built. If you'd like, the list can also warn on screen before sending when the chosen day has no booked deliveries, so it's obvious rather than looking like a fault.

## Fixing the "- Temp van" labels

On the loading page, job cards still show the temp driver name, for example "Load onto Saj - Temp van" and "In Mark - Temp van – failed delivery". These will use the driver's normal name, matching what the loading list messages already do.

## Technical notes

- Apply the existing `normaliseDriverName` helper from `src/utils/driverAssignmentUtils.ts` in:
  - `src/components/loading/PendingStorageAllocation.tsx` — the `collectedByDriver` and `loadedByDriver` grouping keys (`held_by_driver_name`, `delivery_driver_name`, `getCompletedDriverName`) and the three badge labels (lines ~351, ~367, ~420).
  - `src/components/loading/BikesInStorage.tsx` — `deliveryDriverName` (line ~161).
  - `src/components/loading/BikeSearchSection.tsx` — the held-by badge (line ~277).
- Display-only change: no writes, no change to Shipday carrier names, no edge function change or redeploy.
- Optional extra (say if you want it): in `LoadingUnloadingPage.tsx`, block/confirm sending when the selected date has zero bikes with a matching `scheduledDeliveryDate`.
