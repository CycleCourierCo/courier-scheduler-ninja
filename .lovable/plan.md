# Fix Shipday jobs not being created for dashboard bookings

## Confirmed root cause

Your hypothesis is correct — it is a permissions problem, not a Shipday problem.

- Both examples (`CCC754124718246ANDN11`, created 26 Aug 18:30, and `CCC754238650806NEWS20`, created 26 Aug 18:36) were booked by business customer accounts (`sales@probiketrader.co.uk`, `chris@newportcyclingrepairs.co.uk`), both holding only the `b2b_customer` role, neither a test account. Both have no Shipday pickup or delivery reference at all.
- After a dashboard booking, the browser calls the Shipday creation function using the signed-in customer's own token. That function only accepts an internal service-role call or a staff member holding `admin`, `route_planner`, `loader` or `driver`. A `b2b_customer` therefore gets rejected with "Forbidden: Staff access required" every time.
- Orders placed through the API work because they are created server-side and invoke Shipday creation internally with the service role, which passes the same gate.
- The rejection is swallowed into a browser console message and the booking flow navigates away, so nobody sees it and nothing retries.

## Changes

1. **Move Shipday creation off the customer's browser**
   - Trigger Shipday job creation server-side after an order is booked, using the same internal service-role path the API orders already use successfully.
   - Keep the existing staff-only gate on the Shipday function untouched — customers never gain the ability to call it directly, so no privilege is widened.
   - Keep the booking itself succeeding if Shipday is temporarily unavailable, but record the failure durably instead of only in the browser console.

2. **Apply the same path everywhere orders are created**
   - Dashboard single bookings, part-exchange return legs, and bulk upload all use the same server-side trigger, so no creation route is left on the customer's token.

3. **Add a safety net so a miss is self-healing**
   - Extend the existing reconciliation function to find active, non-test orders missing a required Shipday leg and create only the missing leg, honouring the Box My Bike (pickup only) and already-collected (delivery only) rules so nothing is duplicated.
   - Run it on a schedule via the existing authenticated cron-wrapper pattern.

4. **Repair the affected orders and verify**
   - Backfill the two named orders plus any other recent customer-booked orders missing Shipday legs (including `CCC754739140674MATL8`).
   - Verify with a fresh dashboard booking that Shipday references appear without manual sync, confirm function logs show success rather than a 403, and confirm rerunning reconciliation creates no duplicates.

5. **Protect Shipday references from being overwritten**
   - Merge Shipday IDs and webhook events into the order's tracking data atomically instead of rewriting the whole block, which is why some orders had IDs in their columns but missing references in tracking history.

## Technical notes

- Server-side invocation keeps `SUPABASE_SERVICE_ROLE_KEY` strictly inside Edge Functions; it is never exposed to the browser.
- All Edge Function responses retain CORS headers and in-code auth validation.
- Reconciliation queries are server-filtered and paginated to avoid the 1,000-row limit.
- The tracking-data merge helper will be `SECURITY DEFINER` with a fixed `search_path`, executable only by `service_role`.
