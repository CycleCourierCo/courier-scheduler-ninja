# Add label section to Foam My Bike

Mirror the Box My Bike "Shipping label" + tracking-link block inside the Foam My Bike (NI) pipeline, gated to the **Foamed ready** stage and editable by **staff only**.

## Behaviour

- On each Foam My Bike order card, show a "Shipping label" block when the order is at **Foamed ready**, or whenever a label already exists (so it stays visible at Delivered to ferry / Delivered NI).
- Staff at the Foamed ready stage can:
  - Upload a label (PDF or image) — replaces any existing one.
  - Paste and save a courier tracking link.
- Anyone viewing the card can click "View / print" to open the label via a short-lived signed URL, and see the tracking link as a clickable link.
- The **Next** button that moves an order from Foamed ready → Delivered to ferry is disabled until both the label and the tracking link exist, with a tooltip explaining why (same gate as Box My Bike's Advance button).
- Customers (non-staff) see the label and tracking link read-only.

## Technical details

Database migration on `orders`:
- `foam_label_url` (text) — storage path, not a public URL
- `foam_tracking_url` (text)
- `foam_label_uploaded_at` (timestamptz), `foam_label_uploaded_by` (uuid)

Storage:
- New **private** bucket `foam-my-bike-labels`, path `${orderId}/${timestamp}-${filename}`.
- RLS on `storage.objects`: staff can insert/update/select; the order owner can select their own order's files.

`src/components/boxmybike/FoamMyBikeSection.tsx`:
- Add the four new columns to the `FoamOrder` interface and the query `select`.
- Add `uploadLabel` and `saveTrackingUrl` mutations plus a `viewLabel` handler, copied from the Box My Bike implementations (`BoxMyBikePage.tsx:135-192`) — including the open-blank-tab-first trick so the signed URL survives popup blockers.
- Insert the label block in `renderCard` between the sender/receiver block and the existing photos block, reusing the same markup and icons as `BoxMyBikePage.tsx:234-276`.
- Extract/duplicate the `TrackingUrlEditor` pattern for the foam fields.
- Add a `blockedAdvance` check on the Foamed ready → Delivered to ferry transition.

No changes to the Box My Bike page itself; the foam flow keeps its own columns and bucket so the two pipelines stay independent.
