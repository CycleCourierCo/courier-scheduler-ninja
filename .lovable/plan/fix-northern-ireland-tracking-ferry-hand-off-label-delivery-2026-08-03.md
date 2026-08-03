# Fix Northern Ireland tracking: ferry hand-off label + delivery photos

Checked order CCC754212916013STEBT9: it is flagged Northern Ireland, foam stage is `delivered_ni`, it has a ferry timestamp (31 Jul), an NI-delivered timestamp (today) and one delivery photo stored. None of that reaches the customer tracking timeline today.

## Problem 1 — timeline says "Delivered" instead of "Delivered to ferry port"

The public timeline builds delivery events purely from the Shipday delivery job and the order status. When the driver completes the ferry drop, Shipday reports the delivery leg as completed, so the timeline prints "Delivered / Driver has delivered the bike" even though the bike has only reached the ferry port.

Fix: make the timeline Northern-Ireland aware. For NI orders, the completed delivery leg is relabelled "Arrived at ferry port" with a description explaining the bike is now travelling onward by ferry to Northern Ireland. The plain "Delivered" wording is only used for NI orders once the foam stage reaches `delivered_ni`.

## Problem 2 — foam milestones and delivery photos are missing from tracking

The NI/foam stages (pending collection, pending foaming, foamed and ready, delivered to ferry, delivered in Northern Ireland) and the delivery photos taken at the Northern Ireland drop are stored on the order but are never added to the tracking timeline, and the public tracking payload doesn't include them at all.

Fix, mirroring how the existing Box My Bike milestones and proof-of-delivery photos already work:

- Add the foam stage timestamps and the delivery photo references to the public tracking payload.
- Add the foam milestones to the timeline as their own events, in date order with the rest.
- Attach the Northern Ireland delivery photos to the final "Delivered in Northern Ireland" event, displayed the same way as proof-of-delivery images (thumbnail grid, click to open full size).
- Keep the same privacy rule as proof of delivery: the photos are only shown after the receiver has verified their postcode; before that the timeline shows the "Verify delivery postcode to view images" button.
- The same events and photos also appear on the internal order detail timeline and the logged-in customer order page, which share this component.

## Technical notes

- `public._build_public_order_payload`: add `foam_pending_collection_at`, `foam_pending_foaming_at`, `foam_foamed_at`, `foam_delivered_to_ferry_at`, `foam_delivered_ni_at`, a `has_foam_photos` boolean, and `foam_delivery_photos` revealed only when `p_reveal_side = 'receiver'` (same gating as `podUrls`).
- `src/services/orderServiceUtils.ts`: map the new fields through to the existing camelCase `foam*` order properties (already declared in `src/types/order.ts`).
- `src/components/order-detail/TrackingTimeline.tsx`:
  - NI-aware relabel in the `ORDER_COMPLETED` delivery branch and in the status-inferred `delivered` branch, using `isNorthernIreland`.
  - New foam milestone block modelled on the existing Box My Bike block, using `FOAM_STATUS_LABELS` wording.
  - Photo paths are storage object paths, so resolve them to signed URLs with `supabase.storage.from('foam-delivery-photos').createSignedUrl(...)` in an effect, then render through the existing image grid markup.
- Storage: `foam-delivery-photos` is private with no anon read policy, so signed URLs can't be minted for public tracking. Add an RLS policy on `storage.objects` granting `anon`/`authenticated` select for that bucket only (photos live under unguessable order-id paths and the timeline still gates them behind postcode verification).
- No change to how staff mark stages in the Foam My Bike page.
