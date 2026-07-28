## Goal

For Northern Ireland orders, the scheduled "delivery" leg is really the ferry hand-off, so the date shown to the customer is misleading. Keep saving it internally (route builder, Shipday, dispatch, timeslips all stay unchanged) but stop showing a Delivery Date / timeslot on the customer-facing pages.

## What changes

**1. Expose the NI flag on the public tracking payload**

The public tracking page reads orders via the `get_public_order` / `get_public_order_with_proof` database functions, whose payload builder (`_build_public_order_payload`) currently does not include `is_northern_ireland` or `foam_status`. A migration will add both fields to the returned JSON so the front end can tell an NI order apart. No new tables, no policy changes.

**2. Public tracking page (`src/pages/TrackingPage.tsx`)**

- When the order is Northern Ireland: do not render the green "Delivery Date" block or its timeslot.
- Show a short neutral line in its place, e.g. "Delivery date to be confirmed — your bike travels onward by ferry once it reaches the ferry port."
- If the collection date is also absent, the whole "Scheduled Dates" section stays hidden as it does today.

**3. Logged-in customer order page (`src/pages/CustomerOrderDetail.tsx`)**

Same treatment for the delivery date / timeslot block, so both customer views are consistent.

**4. Timeline**

The tracking timeline itself is driven by statuses/events, not by the scheduled delivery date, so it keeps working as-is (ferry hand-off and ferry-port confirmation entries stay).

## Not changing

- The `scheduled_delivery_date` / `delivery_timeslot` values are still written when the ferry leg is scheduled — internal scheduling, Shipday sync and route planning are untouched.
- Admin/staff order views still show the real date.

## Technical notes

- Migration: `CREATE OR REPLACE FUNCTION public._build_public_order_payload(...)` adding `'is_northern_ireland'` and `'foam_status'` to the `jsonb_build_object` result (function body otherwise unchanged, keeps `SECURITY DEFINER` and `search_path`).
- `mapDbOrderToOrder` in `src/services/orderServiceUtils.ts` already maps `is_northern_ireland` → `isNorthernIreland`, so no mapper change is needed once the payload carries it.
