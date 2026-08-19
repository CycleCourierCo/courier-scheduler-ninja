# Box My Bike: depot receiver + buyer contact and updates

Two gaps to close: converting an existing order to Box My Bike leaves the old receiver in place, and the buyer (the person the bike is eventually going to) is never stored or emailed.

## 1. Conversion moves the delivery to the depot

- The "Convert to Box My Bike" dialog now also captures the **buyer**: name, email, phone — pre-filled from the order's current receiver.
- On confirm, the order's receiver is replaced with the depot (Lawden Road, Birmingham, B10 0AD, depot coordinates), matching how a Box My Bike order booked from scratch looks.
- The buyer is stored separately on the order (not as the receiver), the same way the Northern Ireland ferry hand-off keeps an onward contact we don't deliver to directly.
- Removing an order from Box My Bike does not attempt to guess the old receiver back; the dialog warns that the depot address stays and must be edited manually if needed. The buyer record is kept.

## 2. Buyer captured everywhere an order is created

- **Booking form** (Box My Bike toggle on): a Buyer section appears on the Order Details step with name, email, phone — required when Box My Bike is on, since the receiver tab is hidden and auto-filled with the depot.
- **Public API / Shopify**: accepts an optional `boxBuyer` object (`{ name, email, phone }`, also snake_case `box_buyer`) validated and stored when `isBoxMyBike` is true. Documented on the API documentation page.
- **Order page**: the buyer shows in the Box My Bike section of the services panel and is editable by admins.

## 3. Buyer gets kept in the loop (email only)

- The buyer receives the **same receiver-facing notifications** as a normal receiver would (collection scheduled, collected, and the proactive update nudges) — added as a recipient alongside the existing ones, following the ferry hand-off pattern.
- Two extra Box My Bike emails, sent on stage change:
  - **In depot, awaiting boxing** → "Your bike has arrived at our depot and is being boxed for onward shipping."
  - **Collected by 3rd-party courier** → "Your bike has been collected by the courier", including the 3rd-party tracking link (and the courier label reference if present).
- Each email is sent once per stage (guarded by a sent-at timestamp), from the usual notification sender with the usual reply-to.

## Technical notes

- Migration: add `box_buyer jsonb` plus `box_buyer_boxing_email_sent_at` and `box_buyer_collected_email_sent_at` timestamps to `public.orders`. No new table, so existing grants and policies apply unchanged.
- `src/components/order-detail/BoxMyBikeConversion.tsx`: add buyer inputs; on confirm write `is_box_my_bike`, `box_my_bike_status`, `box_buyer`, and `receiver` = `DEPOT_RECEIVER` (shared constant extracted from `src/pages/CreateOrder.tsx` into `src/constants/depot.ts` so both use one definition).
- `src/pages/CreateOrder.tsx`: buyer fields in the Box My Bike branch, zod validation conditional on `isBoxMyBike`; pass through `orderService`.
- `src/types/order.ts`: `boxBuyer?: ContactInfo | null`; map it in `src/services/orderServiceUtils.ts`.
- `supabase/functions/orders/index.ts`: validate and persist `boxBuyer`; same in `shopify-webhook` where Box My Bike orders are created.
- `src/services/emailService.ts`: add the buyer email as an extra recipient on receiver-facing sends when `is_box_my_bike` and a buyer exists; add two new templates for the boxing and 3rd-party-collected notices.
- `src/pages/BoxMyBikePage.tsx`: when the stage patch moves to `in_depot_awaiting_boxing` or `collected_by_3p`, fire the matching email and stamp its sent-at column.
- `supabase/functions/send-order-updates/index.ts`: include the buyer address for Box My Bike orders in the proactive update recipients.
