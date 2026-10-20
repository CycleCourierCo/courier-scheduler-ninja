# Collection photos missing on CCC754365464370LUCS11

## What was found
The order was collected on 19 Oct (Shipday collection job 55038518). Shipday told us twice that the collection was complete, but **both messages came with no photos and no signature**. There is nothing to display, so the tracking page has nothing to show. The page itself isn't broken.

Either the driver took no photo, or Shipday attached it after the job was marked complete and never sent it to us.

## What will change
1. **Ask Shipday directly.** When Shipday tells us a job is complete but sends no photos or signature, the app will look up that job in Shipday a moment later and save any photos or signature it finds.
2. **Fix this order and recent ones.** Do a one-off pass over collected or delivered orders from the last 30 days that have no proof saved, and pull their photos and signatures from Shipday.
3. If Shipday has nothing for this order either, the driver didn't take a photo. I'll tell you so you can follow it up with them.

## Technical notes
- In the Shipday webhook, when ORDER_COMPLETED arrives with empty `podUrls` and no `signatureUrl`, call Shipday's order details API for that order id in the background (`EdgeRuntime.waitUntil`). Then add an `ORDER_POD_UPLOAD` update with the matching `leg` through `apply_shipday_tracking`.
- Backfill uses the same lookup with admin/cron auth and a batch limit.
- No change to the tracking page.
