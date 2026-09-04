# Northern Ireland partner uploads + inbound NI tracking

Two connected pieces of work: give the NI ferry partner (City Air Express) a no-login page to upload a label and their BFS reference, and give staff a way to track inbound NI jobs stage by stage on the Box/Foam My Bike page.

## 1. Partner upload link (unauthenticated)

New public page at `/ni-partner/:orderId`, linked from the ferry partner email.

The page shows, for that one order only:
- Direction, worded plainly ("From Northern Ireland to mainland" / "To Northern Ireland").
- Tracking number, bike make/model, quantity.
- The NI-side customer's name, full address and phone.
- Upload box for the label (PDF or image) and a text field for their BFS number.
- Once submitted: confirmation, the uploaded label link, and the ability to replace it.

Never shown on the page or in the email: the customer's email address. The partner email will have the customer email line removed and the upload link added as a button.

Access model matches the existing public availability and repair-offer pages: the order UUID in the link is the secret, everything is served by a security-definer function that returns only the fields listed above. No account, no sign-in.

## 2. BFS number and label on the order

- Both values show on the order detail page in the Northern Ireland section (with upload timestamp), and the label opens through the `api.cyclecourierco.com` file domain.
- Staff can edit/clear the BFS number and re-upload the label themselves.
- BFS number becomes searchable alongside the tracking number on the Box/Foam pages.

## 3. Inbound Northern Ireland tab

A new "Inbound NI" tab next to Box My Bike / Foam My Bike, listing orders flagged Northern Ireland with inbound direction. Manual stage buttons (forward and back, same pattern as the existing foam stages):

```text
Awaiting NI collection
  -> Collected in Northern Ireland      (partner picked up)
  -> Crossed the ferry                  (in transit to mainland)
  -> Collected from partner             (our City Air Express Shipday job done)
  -> continues through the normal flow
```

Each stage stamps a timestamp and the person who set it. Reaching "Collected from partner" hands the order back to the normal order lifecycle (marks the collection complete so it flows into scheduling/delivery as usual).

Customer tracking is updated at each stage, so the tracking page shows the NI collection, the ferry crossing and the hand-over to us.

## 4. New outbound stage: crossed the ferry, now in Northern Ireland

The existing outbound (Foam My Bike) stages gain one step between "Delivered to ferry" and "Delivered in Northern Ireland":

```text
Foamed, ready for delivery
  -> Delivered to ferry
  -> Crossed the ferry, in Northern Ireland   (new)
  -> Delivered in Northern Ireland
```

Same manual forward/back controls, stamped with a timestamp, and shown on the customer tracking timeline.


## Technical notes

Database migration (one call, approved before code changes):
- `orders`: `ni_partner_label_url`, `ni_partner_label_uploaded_at`, `ni_bfs_number`, `ni_bfs_updated_at`, `ni_inbound_status` (text, checked against the four stages), `ni_inbound_collected_at`, `ni_inbound_ferry_crossed_at`, `ni_inbound_received_at`.
- `get_ni_partner_job(p_order_id uuid)` — security definer, returns direction, tracking number, bike, NI-side name/address/phone, existing label + BFS. Email deliberately excluded.
- `submit_ni_partner_details(p_order_id uuid, p_bfs_number text, p_label_path text)` — security definer, validates the order is a Northern Ireland order, stamps BFS and label fields.
- Grants: `EXECUTE` on both functions to `anon` and `authenticated`; column-level access stays closed (no new table, so no new table grants).

Files:
- New `ni-partner-labels` private storage bucket, created with the bucket tool.
- New edge function `ni-partner-label-upload` (service role, `verify_jwt = false`): validates order is NI, restricts to PDF/PNG/JPG under 10 MB, writes to the bucket, then calls the submit function. Uploads go through the function because anonymous visitors must not get direct bucket write access.
- `supabase/functions/_shared/ferryPartnerEmail.ts` — drop the customer email line, add the upload-link button; new copy for both directions.
- New `src/pages/NiPartnerUpload.tsx` + route in `src/App.tsx` (public, outside `ProtectedRoute`).
- `src/components/order-detail/NorthernIrelandEditor.tsx` — BFS number + label display/edit.
- New `src/components/boxmybike/InboundNiSection.tsx`, tab wired into `src/pages/BoxMyBikePage.tsx`, reusing `OrderSearchBar` and `filterOrdersBySearch`.
- `src/types/order.ts` — inbound NI stage constants and labels.
- `src/components/order-detail/TrackingTimeline.tsx` and `send-order-updates` — inbound NI milestones in the customer-facing timeline.
