# Customer tracking page — rebuild spec for Shopify (cyclecourierco.com/pages/track)

This document describes the existing tracking page in the booking app and the public endpoint the Shopify theme should call. The theme should copy this wording and behaviour exactly.

---

## 1. Existing page

### Routes and files
| Item | Value |
|---|---|
| Search page | `https://booking.cyclecourierco.com/tracking` |
| Order page | `https://booking.cyclecourierco.com/tracking/:id` (`:id` = tracking number, customer order number or internal order UUID) |
| Route definition | `src/App.tsx` (`/tracking`, `/tracking/:id`) |
| Page | `src/pages/TrackingPage.tsx` |
| Shell / header | `src/components/design/DoorstepShell.tsx`, `src/components/design/Signboard.tsx` |
| Journey + events | `src/components/order-detail/TrackingTimeline.tsx` |
| Journey strip stages | `src/utils/journeyStages.ts`, `src/components/design/JourneyStrip.tsx` |
| Postcode dialog | `src/components/order-detail/PostcodeVerification.tsx` |
| Data fetch | `src/services/fetchOrderService.ts` (`getPublicOrder`, `verifyPublicOrderPostcode`) |

### Layout, top to bottom
The page sits in a single centred card, at most 576px wide (`max-w-xl`), with the site header and footer around it.

1. **Signboard header** (dark brand panel)
   - Small uppercase line with a map-pin icon: `Cycle Courier Co.`
   - Title (40px, extra bold): `Track your bike`
   - Under the title: the tracking number (or the searched ID while it loads), in the monospace "data" font.

2. **Search form**. Shown only while no order is loaded.
   - Label: `Enter Order ID`
   - Placeholder: `Enter your order ID (e.g., CCC754...)`
   - Button: `Track`
   - Empty submit: `Order ID is required`
   - Submitting goes to `/tracking/<value>`.

3. **Loading state**: a pulsing package icon with `Loading order information...`

4. **Order card**
   - Heading with a package icon:
     - `Order #<customer_order_number>` if a customer order number exists (for example a Shopify or dealer reference)
     - otherwise `Order #<tracking_number>`
   - `Created on <date>` (browser locale date)
   - Bike line with a bike icon: `<bike_brand> <bike_model>`, plus ` (×N)` when the quantity is more than 1.
   - **Scheduled Dates** section (calendar icon). Shown only if a scheduled collection date exists, or a scheduled delivery date exists and the order is not outbound Northern Ireland.
     - Box `Collection`: date, then `Timeslot: HH:MM - HH:MM` if a timeslot is set.
     - Box `Delivery`: date, then `Timeslot: HH:MM - HH:MM` if a timeslot is set.
     - For outbound Northern Ireland, the Delivery box shows `To be confirmed — your bike travels onward by ferry once it reaches the ferry port.`
     - Note in italics: `* These dates are provisional. You will receive a 3-hour timeslot when an exact date is scheduled in.`
   - Date format is en-GB. Narrow screens (under 640px) use `Tue, 21 Oct 26`. Wider screens use `Tuesday, 21 October 2026`.
   - If neither date is set, the whole Scheduled Dates section is hidden. The page never shows "To be arranged".

5. **"Your journey" card** (truck icon, heading `Your journey`)
   - **Journey strip**: a row of stage dots (see section 3), each done, current or upcoming.
   - **Latest update** box (left accent border): small uppercase `Latest update`, the newest event title, and its date.
   - **Event list**, oldest first. Each row shows:
     - the title (bold)
     - the date as `October 21st, 2026 at 6:45 PM` (date-fns `PPP 'at' p`)
     - the description
     - an optional link (for example `View inspection report (PDF)` or `Track with courier`)
     - proof blocks (see section 5)
   - With no events: clock icon and `Waiting for the first update`.

6. **Errors**
   - Lookup error: `We couldn't load this order. Check the order ID and try again.`
   - Not found: `No order found with this ID. Check the order ID and try again.`

**Not shown:** driver name, driver photo, live map, ETA, or contact links. The page has no contact details of its own; the site header and footer provide them.

---

## 2. Data source

- Table: `public.orders`. The browser cannot read it directly; the page uses two `SECURITY DEFINER` database functions:
  - `get_public_order(p_identifier)`: the default view.
  - `get_public_order_with_proof(p_identifier, p_postcode)`: the same view, plus proof for one side after a postcode match.
  - Both build the reply with `_build_public_order_payload`, which only includes fields on an allow list.
- How an identifier is matched, in order:
  1. a UUID matches `orders.id`
  2. otherwise it matches `tracking_number` (case-insensitive)
  3. otherwise it matches `customer_order_number` (case-insensitive)
- Inspections: `get_public_inspection_summary(tracking_number)`, included as `inspection_summary`.

### Identifier glossary
| Name | Column | Example | Meaning |
|---|---|---|---|
| Tracking number | `tracking_number` | `CCC754425087236PETN11` | The customer-facing reference on labels and emails. Format: `CCC754` + 9 digits + 3 letters + 1–3 letters or digits. |
| Customer order number | `customer_order_number` | `#1234`, a dealer PO | An optional reference from the customer, dealer or Shopify. When present it is shown as the "Order #" heading. |
| Shopify order ID | in `customer_shopify_order_log` / webhook data | `5551234567890` | Shopify's own internal ID. It is never shown on tracking. |
| Order ID | `id` (UUID) | — | Internal only. |

The public endpoint (section 7) only accepts the **tracking number** format.

---

## 3. Statuses and timeline events

### Order status (`orders.status`), with labels from `StatusBadge.tsx`
| Value | Label |
|---|---|
| created | Created |
| sender_availability_pending | Sender Confirmation Pending |
| sender_availability_confirmed | Sender Confirmed |
| receiver_availability_pending | Receiver Confirmation Pending |
| receiver_availability_confirmed | Receiver Confirmed |
| scheduled_dates_pending / pending_approval | Scheduled Dates Pending |
| scheduled | Scheduled |
| collection_scheduled | Collection Scheduled |
| delivery_scheduled | Delivery Scheduled |
| driver_to_collection | Driver En Route to Pickup |
| collected | Bike Collected |
| driver_to_delivery | Driver En Route to Delivery |
| shipped | Shipped |
| delivered | Delivered |
| cancelled | Cancelled |

The public tracking page does not show a status badge. The endpoint returns `status_label` for convenience.

### Journey strip (`journeyStages.ts`)
Stages are added in this order:
- **Standard:** `Booked` → `Collected` → [`Inspected` → `Repaired`] → `In transit` → `Delivered`
- **Box My Bike:** … → `Boxed` → `With courier` → `Delivered`
- **Outbound NI:** … → `Foamed` → `At ferry` → `Crossed ferry` → `Delivered`
- **Inbound NI:** `Booked` → `Collected in NI` → … → `Crossed ferry` → `From partner` → `Delivered`

When each stage counts as done:

| Stage | Done when |
|---|---|
| Booked | always |
| Collected | `order_collected` is true (inbound NI: `ni_inbound_collected_at` is set) |
| Inspected | shown only if `needs_inspection`; done when `inspection_summary.inspected_at` is set |
| Repaired | shown only if repairs were approved or completed; done when `repairs_completed_at` is set |
| In transit / Delivered | status is `delivered` |
| Box My Bike / NI stages | their timestamp is set, or the status has reached that stage |

The **current** stage is the first one that isn't done. Stages after it are **upcoming**. Icons for each stage: booked, collected, inspected, repaired, boxed, transit, foamed, ferry, partner, delivered.

### Event list (`TrackingTimeline.tsx`)
Every event uses the colour `courier-600` (brand) unless marked otherwise. The list is sorted by timestamp, oldest first.

| Title | When it's shown | Description | Icon | Timestamp |
|---|---|---|---|---|
| Order Created | always | `Order created with tracking number: <TN>` | Package | created_at |
| Collection Availability Received | sender_confirmed_at is set | `Thank you. You've submitted your preferred collection dates. We'll confirm your actual collection date shortly.` | ClipboardEdit | sender_confirmed_at |
| Delivery Availability Received | receiver_confirmed_at is set | `Thank you. You've submitted your preferred delivery dates. We'll confirm your actual delivery date shortly.` | ClipboardEdit | receiver_confirmed_at |
| Transport Scheduled | scheduled_at is set | `Transport manager has scheduled pickup and delivery` | Calendar | scheduled_at |
| Driver En Route to Collection | Shipday ORDER_ONTHEWAY, pickup | Shipday text, or `Driver is on the way to collect the bike` | Map | event timestamp |
| Bike Collected | Shipday ORDER_COMPLETED, pickup | Shipday text, or `Driver has collected the bike` | Check | event timestamp |
| Driver En Route to Delivery | ORDER_ONTHEWAY, delivery | Shipday text, or `Driver is on the way to deliver the bike` | Truck | event timestamp |
| Delivered | ORDER_COMPLETED, delivery | Shipday text, or `Driver has delivered the bike` | Check (green) | event timestamp |
| Arrived at ferry port | ORDER_COMPLETED delivery on outbound NI, or foam_delivered_to_ferry_at | `Bike has reached the ferry port and is travelling onward by ferry to Northern Ireland` | Ship | timestamp |
| Collection Failed / Delivery Failed / Job Failed | ORDER_FAILED | Shipday text, or `Collection attempt failed - rescheduling required` (or the Delivery / Job version) | AlertCircle (red) | event timestamp |
| Awaiting Inspection | needs inspection, collected, not yet inspected | `Bike is awaiting mechanic inspection` | Wrench | Bike Collected time |
| Inspection Complete — No Issues Found | inspected, no issues | `Inspection completed — no issues identified` + link `View inspection report (PDF)` | Check (green) | inspected_at |
| Inspection Complete — Issues Found | inspected, issues found | `Issues identified during inspection — awaiting customer approval` + report link | AlertCircle (amber) | inspected_at |
| Repairs Approved | repairs_approved_at is set | `Customer has approved the recommended repairs` | Wrench | repairs_approved_at |
| Awaiting Parts | awaiting_parts_at is set | `Ordering parts required for the approved repairs` | Clock | awaiting_parts_at |
| Parts Arrived — Awaiting Repair | awaiting_repair_at is set | `All parts have arrived — repairs are about to start` | Wrench | awaiting_repair_at |
| Repairs Declined — Proceeding to Delivery | repairs_declined_at is set | `Customer has declined the recommended repairs` | Truck | repairs_declined_at |
| Repairs Completed | repairs_completed_at is set | `All approved repairs have been completed` + `View full inspection report (PDF)` | Check (green) | repairs_completed_at |
| In depot, awaiting boxing | box_in_depot_at is set | `Bike has arrived at the depot and is queued for boxing` | Package | box_in_depot_at |
| Boxed, awaiting label | box_boxed_at is set | `Bike has been boxed and is awaiting a shipping label` | Box | box_boxed_at |
| Awaiting 3rd-party collection | box_label_printed_at is set | `Label printed — awaiting 3rd-party courier collection` + `Track with courier` link | Clock | box_label_printed_at |
| Collected by 3rd-party courier | box_collected_by_3p_at is set | `Bike has been handed to the 3rd-party courier` + link | Truck (green) | box_collected_by_3p_at |
| Delivered by 3rd-party courier | box_delivered_by_3p_at is set | `Bike has been delivered by the 3rd-party courier` + link | CheckCircle (green) | box_delivered_by_3p_at |
| Protective foam packing applied | foam_foamed_at is set | `Bike has been foam-packed ready for the ferry crossing` | Snowflake | foam_foamed_at |
| Crossed to Northern Ireland | foam_crossed_to_ni_at is set | `Bike has crossed the ferry and is now in Northern Ireland awaiting final delivery` | Ship (blue) | foam_crossed_to_ni_at |
| Delivered in Northern Ireland | foam_delivered_ni_at is set | `Bike has been delivered in Northern Ireland` (with photos) | CheckCircle (green) | foam_delivered_ni_at |
| Collected in Northern Ireland | ni_inbound_collected_at is set | `Bike collected by the ferry partner (BFS <n>)`, or without the BFS number | Truck | ni_inbound_collected_at |
| Crossed ferry to mainland | ni_inbound_ferry_crossed_at is set | `Bike has crossed the ferry and is on its way to our depot` | Ship (blue) | ni_inbound_ferry_crossed_at |
| Received from partner | ni_inbound_received_at is set | `Bike has been collected from the ferry partner and will continue to its destination` | CheckCircle (green) | ni_inbound_received_at |

**Filled in from the status** when Shipday hasn't sent the matching event (timestamp = `updated_at`):

| Status | Events added (if missing) |
|---|---|
| driver_to_collection | Driver En Route to Collection |
| collected, driver_to_delivery, delivered | Bike Collected (`Bike has been collected from sender`) |
| driver_to_delivery | Driver En Route to Delivery |
| delivered (not outbound NI) | Delivered (`Bike has been delivered to receiver`) |

**Fallbacks**, used only when there are 2 events or fewer:

| Status | Event | Description |
|---|---|---|
| sender_availability_pending | Awaiting Collection Dates | `Waiting for sender to confirm availability dates` |
| receiver_availability_pending | Awaiting Delivery Dates | `Waiting for receiver to confirm availability dates` |
| scheduled_dates_pending | Scheduling in Progress | `Transport team is scheduling your pickup and delivery` |

Shipday events other than ON THE WAY, COMPLETED and FAILED (for example ASSIGNED and ACCEPTED_AND_STARTED) are **not shown**. `ORDER_POD_UPLOAD` is merged into the matching Completed event. The event's leg comes from the `leg` field (`pickup` / `delivery`).

A cancelled order has no special event. The list shows whatever happened before it was cancelled.

---

## 4. Scheduling

| Field | Type | Meaning |
|---|---|---|
| `scheduled_pickup_date`, `scheduled_delivery_date` | timestamptz | The day the job is booked. Shown as a date only. |
| `pickup_timeslot`, `delivery_timeslot` | `HH:MM:SS` | The start of a 3-hour window. Shown as `Timeslot: HH:MM - HH:MM` (start + 3h, `formatTimeslotWindow`). |
| `pickup_date`, `delivery_date` | array of `YYYY-MM-DD` | The dates the customer said they're **available**. These are not booked dates. Don't show them as scheduled. |

- Dates are always labelled provisional (the note in section 1) until the timeslot is sent. The note shows whenever the Scheduled Dates section shows.
- With no scheduled date, that box (or the whole section) is hidden.
- The tracking page has **no** "choose your availability" link. Customers get the availability links (`/sender-availability/:id`, `/receiver-availability/:id`) by email, WhatsApp and SMS only. The order UUID in those links is a secret, so tracking must not show it.

---

## 5. Proof of collection / delivery

- **Where it's stored:** Shipday hosts the POD photo and signature URLs, saved in `orders.tracking_events.shipday.updates[].podUrls` / `signatureUrl`. These are public Shipday or Supabase-storage URLs, rewritten to `api.cyclecourierco.com` and with no expiry. Northern Ireland foam delivery photos are in the private bucket `foam-delivery-photos`, and the `get-foam-photo-urls` function serves them as 30-minute signed URLs after a delivery postcode check.
- **Before verification:** each event carries `has_pod` / `has_signature`, so the page can show a `Proof of delivery` / `Signature` heading with a lock button:
  - `Verify postcode to view photos`
  - `Verify postcode to view signature`
- **Dialog** (`PostcodeVerification.tsx`):
  - Title: `Verify Collection Postcode` or `Verify Delivery Postcode` (the leg comes from the event clicked)
  - Text: `To view the proof of <collection|delivery> images, please enter the <collection|delivery> postcode.`
  - Field label `Postcode`, placeholder `Enter postcode`
  - Buttons: `Cancel`, `Verify` (shows `Verifying…` while checking)
  - Errors:
    - `Please enter a postcode.`
    - `Incorrect <collection|delivery> postcode. Please try again.`
    - `Too many attempts. Please try again in a few minutes.`
    - `Verification failed. Please try again.`
- **Matching:** case-insensitive with all spaces removed (`_normalise_postcode`). The postcode is compared with the sender postcode first, then the receiver postcode. Either one is accepted, whichever button was pressed:
  - sender match: reveals the **pickup** leg's photos and signature
  - receiver match: reveals the **delivery** leg (plus NI foam photos)
- **Attempt limit:** 10 attempts per order per IP address within 10 minutes (`tracking_postcode_attempts`). Over the limit, nothing is revealed and `rate_limited: true` is returned.
- **After a match:** the photos show as 80×80 thumbnails that open full size in a new tab. The signature shows the same way.

---

## 6. Privacy

**Safe for anyone with the tracking number:** status, created/updated dates, bike brand/model/type/quantity, customer order number, scheduled dates and timeslots, collected/delivered flags, the availability-received timestamps, timeline events (with driver names removed), the inspection summary and report link, Box My Bike / NI stage timestamps, the third-party courier tracking link, and `has_pod` / `has_signature` flags.

**Only after a postcode match:** POD photos and the signature for the matching leg, and NI foam delivery photos (receiver side only).

**Never shown, even after verification:** names, phone numbers, emails, street addresses, postcodes, notes, driver names, internal IDs, the availability-link UUID, prices and invoices. The public endpoint never returns the sender/receiver city either.

---

## 7. Public endpoint

`https://api.cyclecourierco.com/functions/v1/public-track`

| | |
|---|---|
| Methods | `GET` (query string) or `POST` (JSON body). Browsers send `OPTIONS` preflight. |
| Parameters | `ref` **or** `tracking` = tracking number (required). `postcode` (optional). |
| Auth | **None.** No keys or headers needed. The function calls the database with the anon key on the server. Data is protected because the anon role can only call the two sanitising functions, not read `orders`. |
| CORS | Allowed origins: `https://cyclecourierco.com`, `https://www.cyclecourierco.com`, `https://booking.cyclecourierco.com` |
| Caching | Without a postcode: `public, max-age=60`. With a postcode: `no-store`. |
| Rate limit | Postcode checks only: 10 per order per IP per 10 minutes (see section 5). Note the IP is seen through the edge server, so the limit may apply more broadly than one visitor. |

Examples:
```
GET  /functions/v1/public-track?ref=CCC754425087236PETN11
GET  /functions/v1/public-track?ref=CCC754425087236PETN11&postcode=B1%203NJ
POST /functions/v1/public-track   {"ref":"CCC754425087236PETN11","postcode":"B13NJ"}
```

### Status codes
| Case | HTTP | Body |
|---|---|---|
| Found | 200 | see below |
| Wrong postcode | 200 | `postcode_verified: false`, `postcode_error: "Incorrect postcode. Please try again."` (the order is still returned without proof) |
| Too many postcode attempts | 429 | `rate_limited: true`, `postcode_error: "Too many attempts. Please try again in a few minutes."` (the order is still returned) |
| Badly formatted or unknown tracking number | 404 | `{"found":false,"error":"Tracking number not found"}` |
| Server error | 500 | `{"found":false,"error":"Lookup failed, please try again"}` |
| Other method | 405 | `{"error":"Method not allowed"}` |

### Response (200)
```json
{
  "found": true,
  "postcode_verified": false,
  "rate_limited": false,
  "tracking_number": "CCC754425087236PETN11",
  "status": "delivered",
  "status_label": "Delivered",
  "collected": true,
  "delivered": true,
  "collection_date": "2026-10-20",
  "delivery_date": "2026-10-21",
  "collection_timeslot": null,
  "delivery_timeslot": "18:45:00",
  "order": {
    "tracking_number": "...", "customer_order_number": null, "status": "delivered",
    "created_at": "...", "updated_at": "...",
    "bike_brand": "Scott", "bike_model": "Gravel Bike", "bike_type": "...", "bike_quantity": 1,
    "bikes": [{ "brand": "...", "model": "...", "type": "..." }],
    "scheduled_pickup_date": "...", "scheduled_delivery_date": "...", "scheduled_at": "...",
    "pickup_timeslot": null, "delivery_timeslot": "18:45:00",
    "pickup_date": ["YYYY-MM-DD"], "delivery_date": ["YYYY-MM-DD"],
    "order_collected": true, "order_delivered": true,
    "sender_confirmed_at": null, "receiver_confirmed_at": "...",
    "needs_inspection": false, "inspection_summary": null,
    "is_northern_ireland": false, "ni_direction": null, "foam_status": null,
    "foam_foamed_at": null, "foam_delivered_to_ferry_at": null, "foam_crossed_to_ni_at": null, "foam_delivered_ni_at": null,
    "ni_inbound_status": null, "ni_inbound_collected_at": null, "ni_inbound_ferry_crossed_at": null, "ni_inbound_received_at": null,
    "has_foam_photos": false,
    "is_box_my_bike": false, "box_my_bike_status": null, "box_tracking_url": null,
    "box_in_depot_at": null, "box_boxed_at": null, "box_label_printed_at": null,
    "box_collected_by_3p_at": null, "box_delivered_by_3p_at": null,
    "revealed_side": null,
    "events": [
      { "leg": "pickup", "event": "ORDER_COMPLETED", "timestamp": "...",
        "description": "Driver has collected the bike",
        "has_pod": true, "has_signature": true,
        "pod_urls": null, "signature_url": null }
    ]
  }
}
```

`order.pickup_date` / `order.delivery_date` are the customer's **availability** lists. Use `collection_date` / `delivery_date` (or `scheduled_*`) for the booked days.

### Building the page from the reply
- Order heading: `customer_order_number` if set, otherwise `tracking_number`.
- Scheduled Dates: `order.scheduled_pickup_date` / `order.scheduled_delivery_date`, plus timeslot + 3h.
- Events: build the event list in section 3 from the `order.*_at` fields, `order.inspection_summary` and `order.events`. Show only ORDER_ONTHEWAY, ORDER_COMPLETED and ORDER_FAILED from `events`, and fill in from `status` as described there.
- Journey strip: the rules in section 3.
- Proof: if an event has `has_pod` / `has_signature` but no URLs, show the lock button. On submit, call again with `postcode`. If `postcode_verified` is true, show `pod_urls` / `signature_url` for the leg matching `revealed_side` (`sender` = pickup, `receiver` = delivery).
- NI foam photos are not returned by this endpoint. They need `get-foam-photo-urls`, which is not yet open to the retail site.
