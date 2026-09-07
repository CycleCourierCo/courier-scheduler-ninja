# Add a "load in this order" section to each driver's list

Each driver currently gets their bikes grouped by what they're doing with them (collect from depot, keep, hand over, receive), sorted by bay. That stays exactly as it is. On top of that, add one new section so the driver knows the order to physically load the van, so the first drop is nearest the doors.

Nothing changes on the loader's bay breakdown or the management overview.

## What the driver sees

A new section at the top of their own message (WhatsApp and email):

```text
📥 LOAD IN THIS ORDER (deepest first)
1. Trek Domane - Bay A7 - drop 6 of 6 - 16:00-18:00 - J. Smith
2. Giant Defy - from Dave's van - drop 5 of 6 - 15:00-17:00 - A. Khan
3. Cube Attain - Bay B3 - drop 4 of 6 - 14:00-16:00 - R. Patel
...
6. Specialized Allez - already in your van - drop 1 of 6 - 09:00-11:00 - L. Jones
```

- Ordered so the last delivery of the day is loaded first (deepest in the van) and the first delivery loads last.
- Each line shows where to fetch it from (bay, which driver is handing it over, or "already in your van"), the drop number, the delivery time window and the customer.
- Covers every bike that driver is delivering that day: bikes from the bays, bikes already in their van, and bikes being handed to them by another driver.
- Where a bike has no booked time window yet, it goes to the end of the list under a short "no time set" note, so the sequence never silently guesses.
- If none of the driver's bikes have time windows, the section is skipped entirely and the message looks exactly as it does today.

## Technical notes

- The delivery running order comes from each order's `delivery_timeslot` (already on the order record). Sort by the window's start time; reverse it for the load order. Drop numbering is per driver, per day.
- `src/pages/LoadingUnloadingPage.tsx`: add `deliveryTimeslot: order.deliveryTimeslot` to each item in `bikesNeedingLoadingData` in `handleSendWithDriverNumbers`.
- `supabase/functions/send-loading-list-whatsapp/index.ts`:
  - Extend `LoadingListRequest.bikesNeedingLoading` with optional `deliveryTimeslot`.
  - Add `parseTimeslotStart(slot)` (handles "09:00 - 11:00", "9am-11am" style, returns null when unparseable) and `buildLoadOrder(categories)` which merges `bikesToKeep`, `bikesToCollect` and the flattened `bikesByProvider` groups (bikes handed to this driver from another driver), dedupes by order id, sorts by timeslot start descending with unparseable last, and returns entries with drop index.
  - Render it as a new block at the top of `buildDriverMessage` and `buildDriverEmailHtml` only; leave `buildBayBreakdown` and `buildManagementEmailHtml` untouched.
  - Reuse `formatBikeLocation` for the bay text so multi-bay bikes stay in sorted order.
- Deploy `send-loading-list-whatsapp` after the change.
