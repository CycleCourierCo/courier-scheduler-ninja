# Make Shipday creation automatic and server-driven

## Confirmed findings

- Three active, non-test orders created today have no required Shipday references: `CCC754309900774STEKT1`, `CCC754749365159STEB10`, and `CCC754139939756PAUBT3`.
- The deployed Edge Function request logs contain no calls to either `sync-order-shipday` or `create-shipday-order` at the creation times. This means these failures happen before Shipday is contacted.
- Portal creation currently depends on the customer's browser calling `sync-order-shipday` after the database insert. Although the call is awaited, it remains a separate client-side step and is not guaranteed to happen.
- There is no database insert trigger for Shipday creation, and the previously removed 15-minute Shipday cron is inactive.
- The internal service-role authentication path in `create-shipday-order` is valid and will remain private to Edge Functions.

## Changes

1. **Trigger Shipday sync from the database insert**
   - Add an `AFTER INSERT` trigger on `orders` that queues an immediate `pg_net` request to `sync-order-shipday`.
   - Authenticate that callback with the existing cron-secret mechanism; no service-role key will be stored in SQL or exposed to the browser.
   - Update `sync-order-shipday` to accept this verified internal callback, then invoke `create-shipday-order` through its existing service-role path.

2. **Keep creation idempotent and apply order rules**
   - Re-read the order immediately before creating jobs.
   - Create only missing legs, keep Box My Bike pickup-only, skip pickup for already-collected orders, and skip test, cancelled, and delivered orders.
   - Retain the browser call as a harmless fast-path; duplicate requests will return `already_synced` rather than creating duplicate Shipday jobs.

3. **Make failures visible without restoring the cron**
   - Record the automatic invocation outcome against the order/integration logs and add concise non-PII Edge Function logs.
   - Do not restore the removed 15-minute Shipday cron job.

4. **Repair and verify**
   - Run the secured sync for the three currently missing orders.
   - Create a fresh portal booking and verify both Shipday references are written automatically (pickup only for Box My Bike).
   - Confirm function logs show the database-triggered request and confirm a repeated invocation creates no duplicates.

## Technical notes

- Database changes will be made through a migration; the trigger function will be `SECURITY DEFINER` with a fixed `search_path` and restricted execution grants.
- Edge Function responses will retain CORS headers, and logs will not contain customer PII.
- This replaces reliance on browser lifecycle timing while preserving the user's requirement that the recurring Shipday cron remain removed.
