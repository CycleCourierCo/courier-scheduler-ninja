# Merge "- Temp" drivers into the normal driver on loading lists

Some bikes come back with the driver's temp name (for example "Mark - Temp") because of the second driver record used for temp jobs. On the loading lists that shows up as a separate person, so the same driver appears twice with their bikes split between the two entries.

## What changes

Everywhere a driver name is shown or grouped on the loading page and in the loading list messages, the " - Temp" ending is dropped and those bikes are folded into that driver's normal name:

- The loader/management bay breakdown and per-driver blocks list each driver once.
- Each driver's own WhatsApp and email list includes their temp-job bikes.
- The "load in this order" section, hand-over groups ("from Dave's van"), van names and driver counts all use the cleaned name.
- Driver phone/email matching also uses the cleaned name, so a driver whose bikes came in under the temp name still gets their message.

Nothing else about the lists changes — same sections, same bay-and-number ordering.

## Technical notes

- Add a small shared helper (`normaliseDriverName`) that strips a trailing `- Temp` / `-Temp` / `(Temp)` variant, case-insensitive, and trims. Put it in `src/utils/driverAssignmentUtils.ts` and mirror the same function inside `supabase/functions/send-loading-list-whatsapp/index.ts` (edge functions can't import from `src`).
- `src/pages/LoadingUnloadingPage.tsx`: apply it wherever `collection_driver_name`, `delivery_driver_name` and `held_by_driver_name` are read for display, grouping, van labels, the unique-driver set, profile phone/email matching, and the `bikesNeedingLoadingData` payload (so the edge function receives cleaned names).
- `supabase/functions/send-loading-list-whatsapp/index.ts`: normalise `collectionDriverName` / `deliveryDriverName` on every incoming bike once, right after parsing the request body, so all downstream grouping (`categorizeBikes`, `bikesByProvider`, `fromDepotByDriver`, `toDepotByDriver`, bay breakdown, load order) and `driverPhoneNumbers` / `driverEmails` lookups match automatically. Keys of the phone/email maps are normalised too.
- Read-only display change only: no database writes, no change to how Shipday carriers are created or stored.
- Deploy `send-loading-list-whatsapp` after the change.
