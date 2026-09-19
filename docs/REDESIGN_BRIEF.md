# Cycle Courier Co. — Page Inventory & Theme Brief

Purpose: a single source document for a full visual redesign. It describes the
application exactly as implemented today (React 18 + Vite + TypeScript, Tailwind
v3, shadcn/ui, Supabase backend). No code was changed to produce it.

Where a capability does **not** exist, that is stated explicitly rather than
omitted — see §5 (driver views) and §9 (payments).

---

## 1. Audiences and roles

Roles are stored in `public.user_roles` (never on the profile row) and typed in
`src/types/user.ts:2`. A user may hold several. Access is resolved by
`src/components/ProtectedRoute.tsx` against an admin-editable permission matrix
(`role_route_permissions` table, defaults in `src/config/routes.ts`).

| Role | Value | Sees / does |
|---|---|---|
| Public visitor | — | Home, About, Terms, Privacy, API docs, Track Order, auth, and any tokenised link they were sent |
| Business customer (trade) | `b2b_customer` | Dashboard, Create Order, Bulk Upload, own order details, Pricing, Bulk Availability, My Stock, My Inspections, Build My Bike, Box My Bike, profile |
| Consumer customer | `b2c_customer` | **No portal access at all.** Any signed-in B2C-only account gets the "Access unavailable" screen (`ProtectedRoute.tsx:16-31`) with a sign-out button and contact details. Consumers interact only through tokenised links |
| Route planner | `route_planner` | Job Scheduling / Route Builder, Trunk Runs, dashboard with customer filter, order details, tasks, knowledge |
| Sales | `sales` | Dashboard, Notice Bars, Announcement Emails, tasks, knowledge, profile |
| Loader | `loader` | Loading & Storage, Equipment, Box My Bike, Build My Bike, tasks, knowledge |
| Mechanic | `mechanic` | Bicycle Inspections, Labour Times, Mechanic Clock, Box My Bike, Build My Bike, tasks, knowledge |
| Driver | `driver` | Driver Timeslips, Fuel Finder, tasks, knowledge, profile |
| Timeslip admin | `timeslip_admin` | Driver Timeslips (all drivers), tasks, knowledge |
| Customer service | `cs_agent` | Customer Service Inbox, Damage Claims, dashboard, order details, Build My Bike, tasks |
| Fleet manager | `fleet_manager` | Vehicles, Equipment, tasks, knowledge |
| Tech | `tech` | API Keys, Webhooks, Shopify Integration, tasks, knowledge |
| Project manager | `project_manager` | Project Management (weekly board, recurring tasks, workshop queue, dashboard) |
| Admin (super admin) | `admin` | Everything, short-circuited before any permission lookup (`ProtectedRoute.tsx:76-78`). Only admins reach Analytics, Route/Mechanic Profitability, Invoices, Users, Account Approvals, Holidays, Claims, Warehouse Stock, Storage Bays, Notice Bars, Partner Apps, Route Permissions |
| Partner app / API client | not a user role | Acts *as* a customer account via `X-API-Key` or OAuth 2.1 Bearer token (`supabase/functions/_shared/apiAuth.ts`); no UI of its own beyond the consent screen |

**Account states** (`profiles.account_status`): `pending`, `approved`,
`rejected`, `suspended`. A business account that is not `approved` is bounced to
`/auth` (`ProtectedRoute.tsx:86-88`); approval is granted on
`/account-approvals`. Registration of a business account emails both the
applicant and the admin team.

---

## 2. Public pages (no sign-in)

| Route | Name | What's on it |
|---|---|---|
| `/` | Home | Hero "Book your Bike Delivery now!", CTAs that swap by auth state (Sign In / Sign Up vs Create Order / View Dashboard); internal staff also get the My Tasks panel. Recovery-token safety redirect |
| `/about` | About Us | Static marketing copy plus phone number |
| `/terms` | Terms & Conditions | Full T&Cs: definitions, contract formation, excluded services, prohibited items, customer duties, failed-attempt fees, condition recording, payment terms, cancellation tiers |
| `/privacy` | Privacy Policy | UK privacy notice, data categories, rights, `privacy@cyclecourierco.com` |
| `/api-docs` | API Documentation | Partner developer docs: API-key and OAuth 2.1 / PKCE flow, base URL `https://api.cyclecourierco.com/functions/v1`, connect / token / refresh / revoke tables, error codes, download of the partner guide (`docs/PARTNER_API_INTEGRATION.md`) |
| `/auth`, `/auth/:mode` | Log in or Register | Login / Register tabs, a red banner warning consumers not to register, forgot-password, business-registration confirmation state, `next=` handling for OAuth sign-in |
| `/reset-password` | Reset password | Verifies emailed recovery token, sets new password |
| `/tracking`, `/tracking/:id` | Track Order | Order lookup by tracking number. Shows order number, created date, bike brand/model/quantity, scheduled collection/delivery dates and timeslots, NI-specific wording, and the full tracking timeline |
| `/pricing` | Pricing | **Not public** — redirects anyone who is not B2B or admin to the dashboard |

### Tokenised / public-link pages

| Route | Name | What it reveals without sign-in | Identity check |
|---|---|---|---|
| `/tracking/:id` | Tracking | Status timeline and dates freely; **delivery photos and signature are withheld** until a postcode is verified server-side, then served as 30-minute signed URLs | Postcode must match the order |
| `/sender-availability/:id` | Collection availability | Bike summary, business opening hours, calendar for 7 collection dates (single Mon–Fri day for inbound Northern Ireland), notes, alternative location (work address / neighbour) | Postcode field labelled "Pickup postcode", checked against the order |
| `/receiver-availability/:id` | Delivery availability | Same as above for delivery; blocked until sender dates exist or the bike is collected, and until inspection/repairs are resolved | "Delivery postcode" checked against the order |
| `/repair-offer/:id` | Repair offer (receiver) | Already-approved vs newly-offered repair lines with prices, link to the inspection report PDF, approve-all / approve-some / decline, plus "reject all and return to seller" | Link possession only |
| `/inspection-approval/:id` | Inspection approval (owner) | Inspection findings, priced repair items, approve / decline per item, report PDF | Link possession only |
| `/ni-partner/:orderId` | NI partner upload | Customer name, address and phone for the consignment; upload of the City Air Express label (PDF/PNG/JPEG/WebP, ≤10 MB) and BFS consignment number | Link possession only |
| `/oauth/authorize` | Connect with Cycle Courier | Partner app name and logo, the permissions requested, Allow / Cancel | **Requires sign-in**; redirects to `/auth?next=/oauth/authorize…` |

---

## 3. Client portal pages (signed-in customers)

| Route | Name | Who | What's on it |
|---|---|---|---|
| `/dashboard` | Dashboard | B2B, staff | Order list with status filter, free-text search, sort, date range, bike-type filter, missing-dates filter, pagination, bulk collection-label PDF by scheduled date. Staff also see My Tasks |
| `/create-order` | Create Order | B2B | Booking wizard — see below |
| `/bulk-upload` | Bulk Upload | B2B | CSV/XLSX upload, rows grouped into orders by order number, profile-completeness check, per-row error review table, template download |
| `/customer-orders/:id` | Order detail (customer) | B2B, CS, planner | Bike summary, scheduled dates and timeslots, tracking timeline, alternative-location details, eBay collection code, label print, inspection-report download (subject to the 25 Aug 2026 cutoff), reorder |
| `/bulk-availability` | Bulk Availability | B2B | All of the account's orders awaiting dates; multi-select and submit shared dates and notes in one action |
| `/pricing` | Pricing | B2B, admin | Standard delivery price table, NI surcharge (ex/inc VAT), Scotland "coming soon", additional services (inspect/clean/service £60, exact-date and Channel Islands price on request) |
| `/my-stock` | My Stock | B2B | Bikes stored in the warehouse, `stored` vs `reserved`, request-delivery dialog (receiver name/email/phone/address) which creates a new order |
| `/bicycle-inspections` | My Inspections | B2B | Inspection status for the account's bikes, report PDF download |
| `/build-my-bike` | Build My Bike | B2B, mechanic, loader, CS | Bike builds and stored builds, component picking against stock, bike diagram |
| `/box-my-bike` | Box My Bike | B2B, mechanic, loader | Boxing progress cards for the account's bikes |
| `/invoices` | Invoices | admin/sales | Invoice history with public and QuickBooks links (customers receive invoices by email rather than browsing them here) |
| `/profile` | Your Profile | all signed-in | Personal information (name, email read-only, phone); Business information (company/trading name, website); Opening Hours editor (business accounts); Address (line 1/2, city, county, postcode, country, required accounts email for invoicing); Connected Apps card listing OAuth partner connections with revoke |

### Booking flow — `/create-order`, in order

Three sequential tabs (`src/pages/CreateOrder.tsx`, components in
`src/components/create-order/`).

**Step 1 — Bike Details**
- `bikeQuantity` select, 1–8. Repeats a block per bike:
  - `bikes[i].brand`, `bikes[i].model` (required text)
  - `bikes[i].type` — 17 options including e-bike weight tiers, cargo, tandem, folding, wheelset, frameset, bike rack, turbo trainer (drives pricing and van-space weighting)
  - `bikes[i].value` — declared value in £ (required)
- `customerOrderNumber` (optional; also the idempotency key for API orders)
- Toggles:
  - **eBay order** → requires `collectionCode`
  - **Payment required on collection** → requires `paymentCollectionPhone`
  - **Part exchange** → requires exchanged bike brand/model/type (+ optional value); creates the reverse leg
  - **Inspect and Service** (`needsInspection`)
  - **Box My Bike** → receiver auto-fills to the depot and a separate Buyer Details block appears (name, email, `+44` phone)
- `deliveryInstructions` free text

**Step 2 — Collection Information (sender)**
- Contact: name, email, phone (auto-normalised to `+44` + 10 digits, per-failure error messages)
- Address: postcode-led autocomplete (`AddressSearchInput`, UK-only, 3-character minimum, debounced) then editable street, city, county, postcode, country, with hidden lat/lon; Northern Ireland region preserved
- Shortcuts: "Fill in my details" (from profile) and "Select from address book" (contacts)

**Step 3 — Delivery Information (receiver)**
- Same contact + address pair. Hidden entirely when Box My Bike is on

**Not part of the booking form:** no price is shown at any step, no slot or date
is chosen (dates are collected afterwards via the availability link), no
guaranteed-delivery option, and **no payment is taken in-app**. On submit, a
business sender is sent straight to `/sender-availability/:id`; everyone else to
the dashboard.

Claims are **not** customer-raiseable — damage claims are staff-only (§4).

---

## 4. Internal ops pages

| Route | Name | Who | Contents |
|---|---|---|---|
| `/scheduling` | Job Scheduling | planner, admin | See breakdown below |
| `/orders/:id` | Order detail (staff) | planner, CS, admin | See breakdown below |
| `/loading` | Loading & Storage | loader, admin | Storage Unit Layout; Bikes Pending Storage Allocation; Bikes in Storage; dialogs for "Select date for collection labels", "Bikes needing loading", "Send loading list" (loader/driver select, phone, email); outstanding badges; collection-photo thumbnails; natural bay sorting; deepest-first loading order across bays, own van and other drivers' vans |
| `/trunk-runs` | Trunk Runs | planner, admin | Northbound / southbound tabs; per-leg capacity cards with spaces-available and overflow badges; status badges; "New trunk run" dialog; printable manifest |
| `/box-my-bike` | Box My Bike | mechanic, loader, admin | Box / Foam / Inbound-NI tabs; cards with allocation location, "Not allocated", "Service outstanding" badges, stage labels, collection day for inbound NI, label upload + tracking URL field, stage date/time dialogs, service-override dialog |
| `/build-my-bike` | Build My Bike | mechanic, loader, CS, admin | Builds / Stored tabs; customer filter; "New bike build" dialog (customer, build name, product code, type, price, mechanic notes); parts, size, SKU and inventory badges; component picker against warehouse stock; bike diagram; build templates |
| `/bicycle-inspections` | Bicycle Inspections | mechanic, admin | 11 tabs: awaiting, collected, pricing, issues, repairs-declined, pending-receiver, awaiting-parts, awaiting-repair, inspected/serviced, invoiced, schedule. Global search; frame size, workshop-only, API-source, category badges; issue rows with parts/labour/total pricing; repair catalogue behind a bike-category picker; part name/spec/part-number fields; "Who approves?" selection; release to customer with copy-approval-link; "No invoice needed" reason dialog; billing-customer dialog (bill sender or receiver, create QuickBooks customer); walk-in / workshop-only inspections with their own customer details; report regeneration |
| `/admin/labour-times` | Labour Times | mechanic, admin | Times / Multipliers / Van Spaces tabs; searchable labour-time table; multiplier table (modifier, type, value, applies to, notes); van-space weighting per bike type |
| `/mechanic-clock` | Mechanic Clock | mechanic | Clock-in/out card and recent shifts list |
| `/warehouse-stock` | Warehouse Stock | admin | Status and customer filters; table of customer / item / location / status / deposited / actions; "Add stock item" dialog (customer, category, part type, price, frame size, spec, Shopify SKU match, bay, notes); receiving flow |
| `/storage-bays` | Storage Bays | admin | Order / bay / slots / status table; add / edit bay dialog |
| `/equipment` | Equipment | loader, fleet manager, admin | Items / Groups tabs; search; items table (equipment, serial, status, location, condition, next check); groups table (name, category, total, available, out, in repair, checks); assign, movement and maintenance dialogs |
| `/vehicles` | Vehicles | fleet manager, admin | Vehicles / Insurance tabs; registration and make search; table of registration, vehicle, status, purchased, tax, MOT, miles driven, auto-pay, last refreshed; mark-as-sold dialog with mileage; maintenance intervals and logs |
| `/driver-timeslips` | Driver Timeslips | driver, timeslip admin, admin | Draft / Approved / All / Mechanic tabs; timeslip cards with route map preview; create, edit, generate and bulk-assign-vehicle dialogs; driver management |
| `/fuel-finder` | Fuel Finder | driver, admin | Fuel-card settings (name, pence-per-litre), two-location postcode/address comparison, cached station results with cheapest-option badges, anomaly flags |
| `/claims`, `/claims/new`, `/claims/:id` | Damage Claims | CS, admin | List with search and table (claim ID, booking ref, customer, bike, damage type, opened, status, settlement £). New claim: linked order search, damage report, evidence checklist, internal notes. Detail: Details / Evidence / Assessment / Settlement / Notes tabs, timeline, upload, files, note thread, status history |
| `/inbox`, `/inbox/:id` | Customer Service Inbox | CS, admin | All / Mine / Unassigned tabs; search; conversation list, message thread, composer (email via Resend, WhatsApp via SendZen), context panel, conversation tasks |
| `/tasks` | Tasks | all internal staff | Status, priority, assignee and due filters plus search; task list, detail drawer, task dialog, notification bell |
| `/project-management` | Project Management | project manager, admin | Assignee / service / priority / status filters and search; Week / Pending / Repeating / Workshop / Dashboard tabs; 7am–7pm 30-minute weekly grid with duration-based blocks; recurring tasks with 1–60 day horizon; workshop queue (bikes collected yesterday awaiting inspection, repairs with parts arrived) with "add to calendar" |
| `/analytics` | Analytics | admin | Ten tabs: Bike value, Overview, Customers (B2B leaderboard with week/month/last month/3-month/12-month/all-time filters), Products, Performance, Inspections, Vehicles, Drivers, API & Webhooks, Integrations. Recharts charts plus a Google-Maps driver heat map |
| `/route-profitability` | Route Profitability | admin | KPI cards (revenue, costs, profit, drivers); settings card; per-date timeslip table (driver, jobs, stops, mileage, driver pay, custom add-ons, revenue, costs, profit); manual mileage entry; invoice-vs-route comparison (gross vs net) |
| `/mechanic-profitability` | Mechanic Profitability | admin | Per-mechanic economics panels with clickable "queue that day" drill-down listing awaiting-inspection and parts-ready jobs with reasons, availability date, wait time, source and standard minutes |
| `/users` | User Management | admin | "Create new user" card (name, email, password, phone, hourly rate, NI number); all-users table (name, email, phone, role, status, company, active, created); role, status and text filters; edit dialog, driver-licence tab, pending licence uploads, Shipday carriers dialog, opening-hours editor |
| `/account-approvals` | Account Approvals | admin | Pending counter, status filter, table (company, contact, address, status), approve / reject / suspend, business-accounts map |
| `/holidays` | Holidays | admin | Add holidays + existing holidays table; add allowed Friday + allowed Fridays table |
| `/notices` | Notice Bars | admin | Create notice (message, type, roles, expiry); all-notices table with per-role badges |
| `/emails` | Announcement Emails | sales, admin | Recipients by Individual / Role with search and per-profile toggles; subject card; content in Text / Template tabs; scheduled-announcement table (subject, recipients, scheduled for, status); schedule and edit dialogs; WhatsApp broadcast |
| `/api-keys` | API Keys | tech, admin | Generate-key dialog (customer, key name), one-time key reveal dialog, table (customer, key name, prefix, status, last used, created) |
| `/webhooks` | Webhooks | tech, admin | Table (name, endpoint URL, events, status, last triggered, secret prefix), create dialog, delivery logs |
| `/admin/partner-apps` | Partner Apps | admin | Register-app card (client name, redirect URL, logo URL, support email), one-time credentials card, registered-apps list with active / switched-off badges |
| `/admin/route-permissions` | Route Permissions | admin | Matrix of app pages × roles with toggles, "not in menu" badges, save and reset-to-defaults |
| `/shopify-integration` | Shopify Integration | tech, admin | Setup steps, store domain field, connected / pending status badges, SKU manager, recent activity |
| `/knowledge`, `/knowledge/:slug` | Knowledge Base | internal staff | Sidebar of categories and SOPs, article view and editor, version history, checklists and checklist runs, "New SOP" and "New category" dialogs |
| `/reviews`, `/reviews/:id`, `/my-reviews` | Employee Reviews | admin / staff | Employee, type and stage filters; review detail with Self / Manager / Meeting / Response / History tabs, rating grid, actions table, stage stepper |

### Job Scheduling and Route Builder (the most complex screen)

`src/pages/JobScheduling.tsx` + `src/components/scheduling/*` (RouteBuilder is
~4,100 lines).

- **Map mode switcher**: Clusters / Job age / Viable on date. Clusters mode adds a
  "Show k-means clusters" switch; viable mode adds its own date picker. Job-type
  filter: All / Collections / Deliveries. Below the map: driver hours & mileage panel
- **Guaranteed dates panel** (top of Route Builder): collapsible, pending count,
  rows with tracking number, collection-or-delivery-due badge, urgency-coloured
  date badge, bike count, collection-booked state; click to add to the route
- **Job list**: filters for date, collected-only, collecting-today, expired-dates-only,
  inspected-only, plus badges per card for booking age, availability days remaining,
  collection state ("Collecting on Route", "Collected elsewhere same day",
  "Collected earlier", "Collection after delivery!", "Not Collected"), NI ferry state
  ("Crossed ferry - ready to collect" on ferry pickups, "Not collected from ferry
  partner" on customer deliveries), inspection state, foam, hours, notes
- **Dialogs**: Route Timeslots ("Get Timeslots" — per-stop times, route length that
  recalculates as times are typed, bulk WhatsApp/SMS messaging), Save Route, Load
  Route, Route Comparison / multi-CSV analysis, CSV upload and CSV Match Review
  (merged stops, City Air Express / ferry aliases, "Already booked" sorting),
  Timeslot Edit, Update Coordinates (lat/lng), Flip Route
- Saved routes support deep links that pre-populate the sequence

### Staff order detail (`/orders/:id`)

Composed from ~19 cards in `src/components/order-detail/`: OrderHeader with status
badge, ContactDetails, AdminContactEditor (address search + Shipday job
delete/recreate on address change), AdminTrackingEditor, AltLocationDetails
(work address / neighbour), ItemDetails (bike rows, eBay collection code with
copy), BoxBuyerDetails, BoxMyBikeConversion, DateSelection, TimeslotSelection,
SchedulingButtons, StorageLocation, TrackingTimeline (~850 lines, Shipday events
plus POD), OrderServicesPanel (boxing / foaming / inspection / NI service
badges), NorthernIrelandEditor (direction, collection day, partner label, BFS
number, resend partner email), GuaranteedDeliveryCard (payer, date, gross amount
with VAT split, note, invoice trigger), LargeBikeRateToggle, PostcodeVerification,
CustomerUpdatesCard, EmailDeliveryStatus, EmailResendButtons, OrderComments,
plus "Mark as collected" and cancel actions.

---

## 5. Driver-facing pages/views

Drivers are **not** given an in-app run/stop workflow. What exists:

| Screen | Purpose |
|---|---|
| `/driver-timeslips` | The driver's own timeslips: date, route, stops, mileage, hours, vehicle, map preview; draft vs approved |
| `/fuel-finder` | Cheapest-fuel comparison between two locations using the daily station cache and the driver's fuel-card price |
| `/tasks` | Tasks assigned to them |
| `/knowledge` | SOPs |
| `/profile` | Their details and licence documents |

**Run list, stop detail, navigation handoff, collect/deliver confirmation, photo
and signature capture (POD) and exception reporting all happen in the Shipday
driver app**, not in this application. Shipday pushes the outcome back via
`supabase/functions/shipday-webhook` (`ORDER_ACCEPTED_AND_STARTED`,
`ORDER_ONTHEWAY`, `ORDER_COMPLETED`, `ORDER_FAILED`, `ORDER_POD_UPLOAD`), and the
POD photos/signature then surface in the staff tracking timeline and on the
public tracking page behind postcode verification. Loading lists reach drivers as
WhatsApp messages and email, not as a screen.

There is **no offline mode** in this application.

---

## 6. Order lifecycle

Core enum `order_status` (`src/types/order.ts:24-52`), labels and colours in
`src/components/StatusBadge.tsx`.

| Status | Trigger | Set by | Notification |
|---|---|---|---|
| `created` | Order submitted (portal, bulk upload, API, Shopify) | System | Email "Your Order Has Been Created" / "Your Bicycle Delivery" |
| `sender_availability_pending` | Order needs collection dates | System | Email asking the sender for collection dates; reminders until confirmed or collected |
| `sender_availability_confirmed` | Sender submits dates (+ postcode check) | Customer | Inbound NI: ferry-partner email to City Air Express with the chosen day (DB trigger, idempotent) |
| `receiver_availability_pending` | Sender confirmed, or bike collected without sender dates | System | Email asking the receiver for delivery dates |
| `receiver_availability_confirmed` | Receiver submits dates | Customer | — |
| `scheduled_dates_pending` (legacy `pending_approval`) | Both sides have availability, awaiting planning | System | "We're planning your collection" |
| `scheduled` / `collection_scheduled` / `delivery_scheduled` | Planner saves a route / books a leg | Staff | Collection booked / delivery booked email, atomically claimed to prevent duplicates |
| `driver_to_collection` | Shipday `ORDER_ONTHEWAY` on the pickup leg | Driver via Shipday | — |
| `collected` | Shipday `ORDER_COMPLETED`/POD on pickup, re-verified against the Shipday API; or staff "Mark as collected" | Driver / staff | "Bike Collected" email; receiver availability request if dates are missing |
| `driver_to_delivery` | Shipday `ORDER_ONTHEWAY` on the delivery leg | Driver via Shipday | — |
| `delivered` | Shipday completion on the delivery leg | Driver via Shipday | "Your Bicycle Has Been Delivered", with POD behind postcode verification |
| `shipped` | Legacy value retained for old orders | — | — |
| `cancelled` | Staff cancel (Shipday legs deleted first, double-cancel guarded) | Staff | — |

**Exception and branch states**

- **Failed attempt** — Shipday `ORDER_FAILED` reverts rather than terminating: not
  yet collected → back to `scheduled_dates_pending` / availability pending; already
  collected → stays `collected`, the bike is unloaded but shown as held by the
  failing driver (`held_by_driver_name`). Email: "Sorry — we missed your
  collection/delivery"
- **Box My Bike**: `awaiting_depot` → `in_depot_awaiting_boxing` →
  `boxed_awaiting_label` → `awaiting_3p_collection` → `collected_by_3p` →
  `delivered_by_3p`, each staff-set and timestamped; buyer emails on boxing and
  on third-party collection
- **Foam My Bike / NI outbound**: `pending_collection` → `pending_foaming` →
  `foamed_ready` → `delivered_to_ferry` → `crossed_to_ni` → `delivered_ni`;
  ferry-arrival email suppressed for inbound
- **NI inbound**: `awaiting_ni_collection` → `collected_in_ni` → `crossed_ferry`
  → `collected_from_partner` (ferry pickup) → then treated as a mainland delivery
- **Scotland trunk**: `awaiting_trunk_to_scotland` → `in_transit_to_scotland` →
  `at_scotland_depot` → `awaiting_trunk_to_depot` → `in_transit_to_depot`
- **Inspection / repair** (`inspection_status`, separate from order status):
  `pending` → `inspected` | `issues_found` → `in_repair` → `repaired`, with the
  terminal fallback `ship_as_is` ("ship as-is — repairs declined",
  `src/utils/servicingGate.ts:16`). Only `inspected`, `repaired` and (for gating
  purposes) `ship_as_is` count as service-complete; declined repairs pass through
  "Declined — offer to receiver" and "Pending receiver approval". Emails: repairs
  need approval, optional repairs for your bike, repairs confirmed, repairs
  declined (internal), returning to seller
- **Return to seller**: `returnedToSellerAt` on the original plus a new return
  order (`returnedFromOrderId`) created already-collected in the original bay; the
  original is cancelled and its Shipday legs removed

**Providers**: all email is sent through **Resend** from
`notification.cyclecourierco.com` with reply-to `Info@cyclecourierco.com`; all
WhatsApp is sent through **SendZen** (announcements, loading lists, bulk route
messages, CS replies). Senders include `send-email`, `send-order-updates`,
`send-repair-offer`, `send-inspection-approval`,
`finalise-public-repair-offer`, `notify-repairs-declined`,
`reject-repairs-return-to-seller`, `send-ferry-partner-notification`,
`send-loading-list-whatsapp`, `send-announcement-whatsapp`,
`send-sendzen-whatsapp`, `process-scheduled-announcements`,
`send-task-assignment-email`, `send-route-report`, `send-internal-reports`,
`create-business-user`, `weekly-invoice-batch`, `create-quickbooks-invoice`.

**Scheduled work**: pg_cron runs QuickBooks token refresh (weekly), timeslip
generation (00:05), fuel-price refresh (05:00), vehicle refresh (03:00) and a
15-minute Shipday backfill. Proactive customer updates, scheduled announcements,
recurring task generation, weekly invoice batch and internal reports run from
Supabase cron triggers authenticated with `x-cron-secret`.

---

## 7. Key objects and their visible fields

**Order / booking** — tracking number, customer order number, account, status
badge, created/updated, bike rows (brand, model, type, declared value, quantity),
sender and receiver (name, email, phone, full address, county, country, region,
business flag, opening hours), availability dates and confirmed-at, scheduled
pickup/delivery date and timeslot, collection code (eBay), delivery instructions,
sender/receiver notes, alternative location, flags (needs inspection, bike swap,
eBay, Box My Bike, guaranteed delivery, large-bike rate, payment on collection
with phone, created via API, test account), NI direction and stages, foam/box
stages with timestamps, storage locations, loaded-onto-van and held-by-driver,
collection and delivery driver names, Shipday pickup/delivery IDs and event list,
inspection summary (counts approved/declined/pending/resolved, report URL),
invoice numbers and URLs, email sent-at markers.

**Bike / consignment** — brand, model, type, declared value, frame size (stock),
van-space weighting, box/foam state, bay allocation, inspection issues.

**Client account (profile)** — name, email, phone, company/trading name, website,
roles, account status, is_business, is_test_account, address, accounts email,
opening hours, special rate code and price, large-bike rate code, QuickBooks
customer ID, default vehicle, hourly and workshop rates, own-van and van
allowance, active flag, available hours, Shipday driver ID/name, show-sender-on-label,
licence documents (front, back, check code, number, expiry).

**Quote / price** — there is no quote object. Pricing is the account's agreed
rate plus special-rate and large-bike-rate codes, NI ferry surcharge, guaranteed
delivery amount, inspection and repair line items (parts + labour).

**Invoice** — invoice number, customer, date range, line items, net/VAT/gross,
QuickBooks ID and public URL, sent state, batch log.

**Run / route (saved route)** — name, date, driver, vehicle, ordered stop
sequence, starting bikes (numeric, allows half-spaces), total mileage and
duration, created by.

**Stop** — order + leg (collection or delivery), address, timeslot, sequence
position, bike count/spaces, status badges, notes, contact phone.

**Driver** — profile with hourly rate, own van, van allowance, Shipday driver
link, licence documents; timeslips with hours, mileage, stops, pay; name
normalised to strip "- Temp".

**Vehicle** — registration, make/model, status, purchase date, tax and MOT dates,
mileage, auto-pay, insurance policy, maintenance intervals and logs, last
refreshed from DVLA lookup.

**Claim** — claim reference, linked order and booking ref, customer, bike, damage
type, status, opened date, settlement amount, evidence files, checklist, internal
notes, status history.

**Notification** — type/template, channel, recipient, sent-at, delivery events
from the Resend webhook, per-order sent-at claim fields.

---

## 8. Navigation

Implemented in `src/components/Layout.tsx`.

- **Top bar**: logo/home link; desktop primary links (Home; when signed out also
  Track Order and Sign In); for signed-in non-admin staff up to six permitted
  pages surfaced directly; then Theme toggle, task notification bell (internal
  staff) and the user dropdown.
- **User dropdown** — non-admins get "Your Profile" plus every page the permission
  matrix grants them. Admins get the full grouped menu in this order: **Orders**
  (Dashboard, Create Order, Bulk Upload, Track Order, Invoices, Pricing) →
  **Operations** (Project Management, Job Scheduling, Loading & Storage, Warehouse
  Stock, Storage Bays, Trunk Runs, Bulk Availability, My Stock) → **Workshop**
  (Bicycle Inspections, Labour Times, Mechanic Clock, Box My Bike, Build My Bike)
  → **Fleet** (Equipment, Vehicles, Driver Timeslips, Fuel Finder, Damage Claims)
  → **Insight** (Analytics, Route Profitability, Mechanic Profitability) →
  **Comms** (CS Inbox, Tasks, Notice Bars, Announcement Emails, Knowledge Base) →
  **Admin** (Your Profile, Employee Reviews, My Reviews, User Management, Account
  Approvals, Holidays, API Keys, Partner Apps, Webhooks, Shopify Integration,
  Route Permissions, API Documentation).
- **B2B customers** additionally see My Stock, Pricing, Bulk Availability and My
  Inspections.
- **Mobile**: hamburger opens a 250px-wide scrollable `Sheet` mirroring the same
  role logic.
- **Footer**: company name, registration and VAT numbers, address; contact email
  and phone (WhatsApp); Instagram, Facebook, Trustpilot; Quick Links; Legal
  (Privacy, Terms, API Documentation).
- A site-wide notice bar (`NoticeBanner`) can appear above content, targeted by role.

---

## 9. Design notes worth knowing before wireframing

**Devices and conditions**
- Client's desk (desktop, unhurried): Create Order, Bulk Upload, Invoices, Pricing, profile
- Phone, outdoors, one hand, often in sunlight: tokenised availability, repair
  offer, inspection approval and tracking pages — these are the highest-volume
  screens and are used by people who will never log in
- Warehouse floor, tablet or phone, gloves, poor light: Loading & Storage, Box My
  Bike, Build My Bike, Storage Bays, Warehouse Stock, Mechanic Clock
- Workshop bench, tablet: Bicycle Inspections (long forms, many small price fields)
- Van cab, phone: Driver Timeslips, Fuel Finder, loading list messages
- Office, large desktop, dense data: Job Scheduling / Route Builder, Analytics,
  Profitability, Claims, Inbox, Project Management. These must stay dense and
  legible rather than becoming airy marketing pages

**Printed artefacts**
- Collection/shipping labels, 4×6 inch, jsPDF — `src/utils/labelUtils.ts`
  (`generateSingleOrderLabel`) plus helpers `src/lib/pdfLines.ts`,
  `src/lib/pdfText.ts`; label content rules (service, boxing and NI icons,
  optional sender name) in `src/utils/labelUtils.ts`
- Bulk collection labels (multi-page 4×6) — `src/pages/LoadingUnloadingPage.tsx`,
  saved as `collection-labels-YYYY-MM-DD.pdf`
- Trunk-run manifest — `src/pages/TrunkRunsPage.tsx` `printManifest()`, HTML in a
  popup window for browser print (no PDF library)
- PDI / inspection report A4 PDF — `supabase/functions/_shared/inspectionReport.ts`
  (jsPDF in Deno), invoked by `supabase/functions/inspection-report`; regenerated
  from `src/services/inspectionService.ts`
- Invoices — generated in QuickBooks, surfaced as public/QuickBooks URLs
- Loading lists — WhatsApp and email, not printed

**Maps** — two libraries coexist. **Leaflet** (`react-leaflet`, `leaflet.heat`,
global CSS at the bottom of `src/index.css`) powers ClusterMap, JobMap, HeatLayer,
JobAgeHeatMap, ViableJobsHeatMap, TimeslipMapPreview, FuelFinderPage and
BusinessAccountsMap, with shared markers in `src/lib/mapMarkers.ts`. **Google
Maps** (`src/hooks/useGoogleMaps.ts`) powers the analytics driver heat map and
the integrations section, and Google is used for route distance/duration.
Geoapify provides address autocomplete.

**Payments** — none in-app. No Stripe or checkout code exists. Charging is
QuickBooks invoicing after the fact; "payment required on collection" simply
instructs the driver to phone a number.

**Status colours that must survive** — these are currently raw Tailwind classes,
not tokens, and carry operational meaning: grey = created/none, yellow/amber =
awaiting customer or awaiting action, blue = scheduled/booked, purple = en route,
green = collected/delivered/complete/approved, red = failed/cancelled/declined/
overdue, indigo and cyan = NI and trunk stages, sky = inspection states. Route
Builder additionally uses red/amber/green for urgency (days remaining, job age)
and eight distinct polygon-segment colours (`p1-segment`…`p8-segment` in
`src/components/ui/badge.tsx`) for map clusters. Any new palette must keep eight
visually distinct segment colours and the red/amber/green urgency ramp.

**Current theme being replaced** — no webfont is loaded at all; the app runs on
the system font stack. Primary is green `142 76% 36%` with a violet-tinted
near-white background (`250 100% 99%`) and a gradient body background. Radius is a
very round `1rem`. shadcn/ui is the component library, Tailwind v3, lucide-react
icons, sonner toasts, recharts charts. Glassmorphism helpers (`.glass`,
translucent card/popover tokens), float/shine/hover-lift animations and gradient
scrollbars are in use. A legacy hardcoded `courier` green palette (`#4C6762` at
500) lives in `tailwind.config.ts`. Dark mode is fully defined and user-togglable.

---

## 10. Integrations

| Service | What it does | Where it appears in the UI |
|---|---|---|
| **Shipday** | Driver dispatch, driver app, POD capture, webhooks back into order status | Order detail tracking timeline and admin tracking editor; carriers dialog in User Management; sync/verify/backfill run in the background; Analytics → Integrations |
| **Resend** | All transactional and announcement email; inbound email into the CS inbox; delivery-event webhook | Email delivery status and resend buttons on order detail; Announcement Emails page; CS inbox |
| **SendZen** | All WhatsApp: announcements, loading lists, bulk route messages, CS replies | Announcement Emails page (WhatsApp broadcast), Send Loading List dialog, Bulk Route Message dialog, CS inbox composer. Template list fetched from SendZen |
| **QuickBooks Online** | Customer records, invoices, VAT | Invoices page (connect flow, invoice history with QuickBooks links); inspection billing-customer dialog; guaranteed-delivery and box/build invoices |
| **Shopify** | Inbound orders from customer stores, line-item and metafield mapping (eBay collection code, inspection/service products) | Shopify Integration page: setup steps, store domain, connected/pending badge, SKU manager, recent activity |
| **Geoapify** | UK address autocomplete and geocoding | Address search in Create Order, profile, registration and the order-detail contact editor |
| **Google Maps** | Distance/duration, analytics heat map | Analytics driver heat map and integrations section |
| **Inspectabike** | External inspection jobs and fault webhooks (`https://api.inspectabike.com`) | Inspection records flagged with their source; status pushed back automatically |
| **OAuth partner apps (e.g. VeloDealer)** | Third-party booking via OAuth 2.1 + PKCE, same access as the customer's API key | `/oauth/authorize` consent screen; `/admin/partner-apps` registration with one-time credentials; Connected Apps card on the customer profile with revoke |
| **Customer API keys** | Direct server-to-server order creation | `/api-keys` admin page; `/api-docs` |
| **Webhooks (outbound)** | Order events pushed to customer endpoints | `/webhooks` page: endpoints, events, secret prefix, last triggered, delivery logs |
| **DVLA vehicle lookup** | Tax/MOT/vehicle data refresh | Vehicles page "last refreshed" column |
| **Sentry** | Error and performance monitoring | Not user-visible; error boundary fallback screen |
| **OSRM / VROOM / Verso** | Considered for route optimisation | Not integrated; no UI |

---

## 11. How the theme gets implemented

**Token files**
- `src/index.css` — `@layer base` with `:root` (light) and `.dark`. Tokens:
  `--background`, `--background-gradient`, `--foreground`, `--muted(+foreground)`,
  `--popover(+foreground, with alpha)`, `--card(+foreground, with alpha)`,
  `--border`, `--input`, `--primary(+foreground, +glow)`, `--secondary(+foreground)`,
  `--accent(+foreground)`, `--destructive(+foreground)`, `--ring`,
  `--gradient-primary/secondary/hero`, `--shadow-elegant/glow/card`,
  `--transition-smooth/bounce`, `--radius: 1rem`. All colours are HSL triplets.
  Base layer styles the body with the gradient, themes the scrollbar, and adds
  touch-reliability rules. `@layer components` provides `.text-gradient`, `.glass`,
  `.float`, `.glow`, `.hover-lift`, `.btn-shine`. Leaflet CSS is imported at the
  bottom with container/popup/marker overrides (marker images are loaded from
  unpkg).
- `tailwind.config.ts` — `darkMode: ["class"]`, `hoverOnlyWhenSupported`, container
  centred at 1400px; colours mapped to the CSS vars including the sidebar set; a
  **hardcoded** `courier` scale 50–950; `backgroundImage` for the three gradients;
  `boxShadow` elegant/glow/card; `borderRadius` from `--radius`; animations float,
  shine, fade-in, slide-up, accordion; plugins `tailwindcss-animate` and typography.
- No font is loaded — `index.html` only sets a system stack for the pre-boot
  loading screen. Introducing a typeface is a net addition, not a replacement.

**Components** — 46 shadcn/ui primitives in `src/components/ui`: accordion,
alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar,
card, carousel, chart, checkbox, collapsible, command, context-menu, dialog,
drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar,
navigation-menu, pagination, popover, progress, radio-group, resizable,
scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch,
table, tabs, textarea, toast, toggle, toggle-group, tooltip.

Custom variants:
- `src/components/ui/button.tsx` — stock variants plus **`premium`** (gradient +
  glow) and **`glass`**; all token-based
- `src/components/ui/badge.tsx` — stock plus **`success`** (`bg-green-500
  text-white`), **`warning`** (`bg-amber-500`), `progress`/`active` (courier
  palette) and eight `p1-segment`…`p8-segment` variants with literal hex values.
  These are the main non-token colour source

Custom (non-shadcn) components worth knowing: the Route Builder and its dialog
family, Leaflet maps and heat layers, storage-unit and bay layout grids, bike
diagram and component picker, weekly time-grid board, tracking timeline,
availability calendar, address search input, inspection issue editor, PDF label
generator, markdown SOP viewer/editor, chart wrappers around recharts.

**Dark mode** — fully defined and live. `src/contexts/ThemeContext.tsx` stores
`light`/`dark` in localStorage (with a safe-storage fallback) and toggles the
class on `document.documentElement`; `src/components/ThemeToggle.tsx` renders the
sun/moon button in both the desktop and mobile headers of `Layout.tsx`.
`next-themes` is installed but unused.

**Hardcoded colours that would survive a token swap** — approximate file counts
across `src/`: `text-white` 25 files, `bg-green-*` 37, `text-green-*` 41,
`bg-amber-*` 32, `bg-blue-*` 22, `bg-red-*` 16, `bg-black` 5,
`border-yellow-*` 4. Ranked by occurrences:

| File | Approx. hits | What the colour means |
|---|---|---|
| `src/components/scheduling/RouteBuilder.tsx` | 41 | Job/leg state, urgency, segment colours |
| `src/components/StatusBadge.tsx` | 17 | Every order status colour (switch returning raw classes) |
| `src/pages/TrackingPage.tsx` | 9 | Public timeline states |
| `src/pages/LoadingUnloadingPage.tsx` | 9 | Bay/allocation state |
| `src/components/analytics/MechanicProfitabilityPanel.tsx` | 9 | Profit/loss |
| `src/pages/OrderDetail.tsx` | 8 | Order status and service badges |
| `src/components/order-detail/TrackingTimeline.tsx` | 8 | Event states |
| `src/components/scheduling/CSVMatchReviewDialog.tsx` | 7 | Match confidence |
| `src/pages/TrunkRunsPage.tsx` | 6 | Run status, capacity overflow |
| `src/pages/RouteProfitabilityPage.tsx` | 6 | Profit/loss |
| `src/components/scheduling/GuaranteedDatePanel.tsx` | 6 | Days-remaining urgency |
| `src/pages/ClaimDetail.tsx` | 5 | Claim status |
| `src/pages/BicycleInspections.tsx` | 5 | Inspection/issue status |
| `src/pages/InvoicesPage.tsx` | 5 | Invoice state |
| `src/pages/FuelFinderPage.tsx` | 5 | Cheapest/dearest |
| `src/components/scheduling/RouteComparisonDialog.tsx` | 5 | Route comparison |
| `src/components/loading/BikesInStorage.tsx` | 5 | Storage state |
| `WarehouseStockPage`, `EmailDeliveryStatus`, `StorageUnitLayout`, `PendingStorageAllocation` | 4 each | Stock/email/storage state |
| `ShopifyIntegrationPage`, `NewClaim`, `CustomerOrderDetail`, `AccountApprovals`, `SchedulingCard`, `OrderServicesPanel`, `DateSelection`, `ResetEmailSent`, `YearlyProfitabilityChart` | 3 each | Connection, claim, approval, service, date state |
| `src/components/ui/badge.tsx` | 10 variants | `success`/`warning` + eight hex segment colours |
| `tailwind.config.ts` | 11 hex values | Legacy `courier` palette |

Recommended approach for the redesign: introduce semantic status tokens
(`--status-pending`, `--status-scheduled`, `--status-transit`, `--status-success`,
`--status-warning`, `--status-danger`, `--status-info`, plus `--segment-1…8`),
then convert `StatusBadge.tsx` and `badge.tsx` first — they are the shared source
most other files imitate — before sweeping the per-page inline classes above.
