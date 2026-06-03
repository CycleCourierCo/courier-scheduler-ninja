# Box My Bike — Implementation Plan

A new order option that books a one-leg collection to our depot, where we box the bike up, the customer uploads a shipping label, and a 3rd-party courier collects it. Billed at £60 + VAT in addition to the courier fee.

## 1. Database (migration)

New column on `orders`:
- `is_box_my_bike boolean default false`
- `box_my_bike_status text` — one of `awaiting_depot`, `in_depot_awaiting_boxing`, `boxed_awaiting_label`, `awaiting_3p_collection`, `collected_by_3p` (nullable; only set when `is_box_my_bike = true`)
- `box_label_url text`, `box_label_uploaded_at timestamptz`, `box_label_uploaded_by uuid`
- `box_my_bike_invoice_id text`, `box_my_bike_invoice_number text`, `box_my_bike_invoice_url text`
- Timestamp columns per stage transition (`boxed_at`, `label_printed_at`, `collected_by_3p_at`) for the customer timeline.

New private storage bucket `box-my-bike-labels`. RLS on `storage.objects`:
- Customer (order owner) can `INSERT`/`SELECT` files under `{order_id}/...`
- Admin + mechanic can `SELECT`/`INSERT`/`UPDATE`/`DELETE`

Order-level mutation of `box_my_bike_status`, label fields, and stage timestamps: extend existing orders UPDATE policies — customers can only set the label fields; admin/mechanic can advance/revert status.

## 2. Create Order form (`OrderOptions.tsx`, `CreateOrder.tsx`)

- New toggle "Box My Bike" (with helper text: international shipping, customer provides label, £60 + VAT).
- When ON:
  - Force `isBikeSwap = false` and `isEbayOrder = false` is **not** required (per your answer toggles remain independent), but `needsPaymentOnCollection` and others remain available.
  - Hide the Delivery tab/step entirely and skip its validation; auto-populate `receiver` with depot contact (Cycle Courier, depot phone/email, `Lawden Road, Birmingham, B10 0AD`, lat/lon from `DEPOT_LOCATION`).
  - Submit button label switches to "Book Box My Bike" and routing jumps straight from Collection → Options → Submit.

## 3. Public API (`supabase/functions/orders/index.ts`)

- Accept `isBoxMyBike` / `is_box_my_bike` on POST. When true, `receiver` is optional and server auto-fills the depot. Returned order payload includes `is_box_my_bike` + `box_my_bike_status`.
- Update `docs/API_DOCUMENTATION.md` and `ApiDocumentationPage.tsx` with the new field + behaviour.

## 4. Invoicing

- New edge function `create-box-my-bike-invoice` modelled on `create-inspection-service-invoice`. Hardcoded line: "Box My Bike Service" £60 net + 20% VAT, attached to the order's customer (B2B/B2C handled the same way the inspection invoice does).
- Trigger on order creation (when `is_box_my_bike = true`) the same way the inspection invoice flow triggers, and store id/number/url on the order. Courier delivery invoice is unchanged and still raised by the existing flow.

## 5. Box My Bike workspace page

New route `/box-my-bike` (`src/pages/BoxMyBikePage.tsx`) visible to admin, mechanic, b2b_customer, b2c_customer. Nav entry added to `Layout.tsx`.

**Admin / mechanic view** — 5 tabs (one per stage):
1. Awaiting delivery to depot
2. In depot awaiting boxing
3. Boxed awaiting label
4. Awaiting collection by 3rd-party courier
5. Collected by 3rd-party courier

Each card shows order ref, bike, customer, collection driver, and label preview (when uploaded). Buttons: **Advance →** and **← Revert** (mechanic + admin). Stage 3 → 4 is only allowed once a label is uploaded; the "Print label" button opens the PDF/image. Stage transition writes the corresponding timestamp and pushes a tracking event.

**Customer view**: list of their own Box My Bike orders with a timeline combining the standard collection/delivery events (collected, in depot) and the box-my-bike statuses; at stage "Boxed awaiting label" a label upload control (drag-drop into `box-my-bike-labels` bucket) is shown.

## 6. Customer-facing tracking

- `StatusBadge` / `TrackingTimeline` / `CustomerOrderDetail` extended to render the box-my-bike sub-status alongside the order status, so existing tracking pages keep working but show the extra milestones for these orders.

## Technical notes

- New status column rather than reusing `OrderStatus` enum, so the existing delivery-side flow (Shipday, emails, route builder) is untouched. The order status remains `collected` once the bike reaches the depot; the box-my-bike journey runs in parallel via `box_my_bike_status`.
- Depot constant already exists at `src/constants/depot.ts` — reuse it for receiver auto-fill in the form and the API.
- Auto-advance to `in_depot_awaiting_boxing` when the order's main status becomes `collected` (handled in the shipday-webhook completion path).
- Bulk CSV upload (`bulkOrderService.ts`) defaults `isBoxMyBike` to false; no spec change there.
- No changes to driver/dispatch logic — Box My Bike orders flow through collection like any other order; the delivery leg is simply never created (no Shipday delivery job, no delivery email).
