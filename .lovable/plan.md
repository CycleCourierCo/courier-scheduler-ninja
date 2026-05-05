## Link claims directly to an order + drop redundant snapshot columns

Claims will reference an existing order. Customer/booking/bike/date fields are read **live** from the linked order — no duplication, no autofill.

### 1. DB migration — drop redundant columns from `claims`

Drop (all currently empty, no existing claims):
- `customer_name`, `customer_email`, `customer_phone`
- `collection_date`, `delivery_date`
- `route_name`, `driver_name`
- `bike_make_model`, `declared_value`
- `has_upgrades`, `upgrades_notes` (upgrades live on the order/bike snapshot)

Keep:
- `order_id` — make `NOT NULL` going forward
- `booking_ref` — keep as a denormalised stable human reference (also used for search/sort on the list); auto-populated from `order.tracking_number` on insert
- `damage_type`, `damage_description`, `recorded_at_delivery`, `notification_date`, `within_timeframe`
- All `ev_*` evidence flags
- Assessment + settlement + notes columns

### 2. Service layer — `src/services/claimsService.ts`

- `searchOrdersForClaim(query)` — `.or()` over `tracking_number`, `receiver->>name`, `receiver->>email`, `sender->>name`, limit 20
- `createClaim` requires `order_id`; auto-fills `booking_ref` from the picked order's `tracking_number`
- `getClaim(id)` returns `{ claim, order }` (second query against `orders`)
- `listClaims()` batches a single `orders` fetch keyed by all `order_id`s and merges
- `deriveClaimDisplayFields(claim, order)` exposes:
  - customer ← `order.receiver` (fallback `order.sender`) — name/email/phone
  - collection_date ← `order.scheduled_pickup_date`
  - delivery_date ← `order.scheduled_delivery_date`
  - driver ← `order.delivery_driver_name ?? order.collection_driver_name`
  - bike ← first entry of `order.bikes` JSONB → `${brand} ${model}`, fallback `bike_brand + bike_model`
  - declared_value ← `order.bike_value`

Per Data Truth memory: read from `bikes`/`sender`/`receiver` JSONB first.

### 3. New Claim form — `src/pages/NewClaim.tsx`

Replace "Booking Details" + "Bike Details" cards with a single **"Linked Order"** picker:
- Search combobox (shadcn `Command` + `Popover`)
- Results: tracking #, customer, sender → receiver postcode, dates, status
- After selection, show a read-only summary card pulled from the order
- "Change order" button to re-pick
- Submit disabled until an order is linked

What stays manual:
- Damage Type, Recorded at delivery, Damage Description, Notification Date
- Evidence checklist
- Internal notes

### 4. Claims list — `src/pages/ClaimsList.tsx`

- Customer / Bike / Booking / dates columns render derived values from the linked order
- Search input matches against derived fields too

### 5. Claim detail — `src/pages/ClaimDetail.tsx`

- Sticky left summary panel reads derived fields live from the order
- "View order" link to the order page
- Details tab: linked-order panel + "Change linked order" action (no editable booking/customer/bike inputs)
- Damage / Assessment / Settlement / Notes tabs unchanged

### Verification

- `/claims/new` shows order picker only → submit disabled until an order is picked → claim created with `order_id` + `booking_ref` set, all other booking/customer/bike columns gone
- `/claims` list shows customer/bike/dates pulled live (edit the order → claim row reflects it on refresh)
- `/claims/:id` shows live order summary + "View order" link works
- DB: dropped columns no longer present on `claims`; `order_id NOT NULL` enforced