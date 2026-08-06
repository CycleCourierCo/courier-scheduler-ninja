# Northern Ireland → mainland (inbound) orders

Today Northern Ireland is only recognised on the **receiver** side. Verified in the code:

- `src/services/orderService.ts:393-400` and `supabase/functions/orders/index.ts:276-307` classify the order from the receiver address only.
- `src/utils/niDelivery.ts:71-85` swaps in the ferry hand-off coordinates for **delivery** legs only; pickup legs always use the sender address.
- `create-shipday-order` (lines 158-294) only rewrites the **delivery** stop contact/address for NI.
- `create-quickbooks-invoice` (lines 579-594) adds the £100 surcharge based on the receiver address.

So a booking from Northern Ireland to the mainland is treated as an ordinary job: no surcharge, and the collection stop is planned in Northern Ireland, which no driver can service.

## What we'll build

An **inbound** NI direction that mirrors the existing outbound flow:

- Ferry partner collects from the customer in Northern Ireland.
- We collect the bike from the Manchester ferry hand-off point.
- Same £100 + VAT per-bike surcharge.
- No foam step — the bike arrives already packed.
- Delivery leg to the mainland receiver stays completely normal.

## Behaviour by area

**Order creation (portal, API, Shopify)**
- Classify both ends. Set `is_northern_ireland` when either side is NI, plus a new `ni_direction` of `outbound` (receiver in NI) or `inbound` (sender in NI).
- Inbound orders skip the foam pipeline: `foam_status` stays null.

**Job scheduling / route builder**
- Inbound: the **pickup** stop resolves to the ferry hand-off coordinates and contact, labelled "Ferry hand-off (collection)". Multiple inbound pickups on the same day bundle into one ferry stop, exactly like outbound deliveries do now.
- Outbound stays as it is today.

**Shipday**
- Inbound pickup job is created against the ferry hand-off address/contact, with a note block listing the real NI sender(s) and tracking numbers so the driver knows what to expect.
- Inbound delivery job is a normal mainland delivery.

**Comms**
- Timeslot WhatsApp/email for an inbound pickup goes to the ferry hand-off contact (not the NI sender), matching the existing outbound behaviour.
- The NI sender gets a customer-facing note that the bike is collected by our ferry partner and handed to us in Manchester, so no timeslot is promised at their door.
- Ferry partner notification lists the NI collection address so they can arrange the NI-side pickup.

**Invoicing**
- Surcharge triggers on the NI flag regardless of direction; the line description keeps the same NI surcharge wording.

**Tracking / order detail**
- Inbound timeline reads: collected by ferry partner → arrived at ferry port → collected by us → out for delivery → delivered.
- Collection date is hidden for inbound NI orders (mirroring how the delivery date is hidden for outbound), shown as "arranged by our ferry partner".
- `NorthernIrelandEditor` on the order page gains a direction choice so existing orders can be marked inbound retrospectively.

**Pricing page**
- The Northern Ireland card notes the surcharge applies in both directions.

## Technical notes

- Migration: add `ni_direction text` to `public.orders` (nullable, values `outbound` / `inbound`), backfill existing `is_northern_ireland` rows to `outbound`.
- Extend `src/utils/northernIreland.ts` / `supabase/functions/_shared/northernIreland.ts` with `resolveNiDirection(sender, receiver)`.
- Extend `src/utils/niDelivery.ts`: `resolveStopCoords` and `getLegContact` become direction-aware so `pickup` returns the ferry hand-off for inbound orders; add `isInboundNi` / `isOutboundNi` helpers.
- Update `RouteBuilder.tsx` contact-key grouping so inbound pickups share the `ni-ferry-handoff` key.
- Update `create-shipday-order`, `send-timeslot-whatsapp`, `send-sendzen-whatsapp`, `send-email`, `orders`, and `create-quickbooks-invoice` to branch on direction rather than assuming the delivery leg.
- `deliveryExpectations.ts` already flags BT postcodes as remote, so timeframe wording needs no change.

## Out of scope

- No NI → NI handling (both ends in Northern Ireland).
- No change to the outbound foam workflow.
