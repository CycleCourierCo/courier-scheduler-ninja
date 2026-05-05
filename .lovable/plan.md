## Damage Claims Module — Internal Dashboard

Admin-only case-management tool for handling damage/loss claims. No customer-facing surface; all entries created by staff.

### Routes (added to `src/App.tsx`)
- `/claims` — list view (admin only)
- `/claims/new` — new claim form (admin only)
- `/claims/:id` — individual claim view with tabs (admin only)

All wrapped in `ProtectedRoute adminOnly`. Nav link "Claims" added to `src/components/Layout.tsx` desktop + mobile menus (admin-gated, near Vehicles).

### Database (Supabase migration)

**Enum** `claim_status`: `open | awaiting_info | under_review | offer_made | settled | rejected | closed`
**Enum** `claim_damage_type`: `visible | concealed | loss | missing_parts`

**Table `claims`**
- `id uuid pk`, `claim_ref text unique` (format `CLM-YYYY-XXXX`, generated server-side via sequence + trigger)
- `status claim_status not null default 'open'`
- Booking: `booking_ref text not null`, `order_id uuid null` (optional FK-style ref to `orders.id`), `customer_name`, `customer_email`, `customer_phone`, `collection_date date`, `delivery_date date`, `route_name`, `driver_name`
- Bike: `bike_make_model`, `declared_value numeric`, `has_upgrades bool default false`, `upgrades_notes text`
- Damage: `damage_type claim_damage_type`, `damage_description text`, `recorded_at_delivery text` (`yes|no|unknown`), `notification_date date`, `within_timeframe bool` (auto-computed)
- Evidence checklist: 9 boolean columns (`ev_booking_ref`, `ev_pre_collection_photos`, `ev_delivery_photos`, `ev_full_bike_photos`, `ev_proof_ownership`, `ev_proof_value`, `ev_upgrade_details`, `ev_repair_estimate`, `ev_delivery_note`)
- Assessment: `claim_kind text` (`repair|total_loss`), `assessor_appointed bool`, `assessor_name`, `repair_quote numeric`, `market_value numeric`, `betterment bool`, `betterment_amount numeric`, `betterment_reason text`, `recommended_settlement numeric`, `settlement_override_reason text`
- Settlement: `offer_amount numeric`, `offer_date date`, `offer_accepted text` (`yes|no|pending`), `payment_reference text`, `settlement_notes text`, `title_transferred bool default false`
- `internal_notes text` (free text from form)
- `created_by uuid`, `created_at`, `updated_at`

**Table `claim_evidence_files`** — uploaded photos/docs
- `id`, `claim_id`, `storage_path`, `file_name`, `mime_type`, `label`, `kind` (`photo|document`), `uploaded_by`, `uploaded_at`

**Table `claim_notes`** — chronological log
- `id`, `claim_id`, `author_id`, `author_name`, `note text`, `created_at`

**Table `claim_status_log`** — audit
- `id`, `claim_id`, `from_status`, `to_status`, `changed_by`, `changed_by_name`, `changed_at`, `note text null`
- Trigger on `claims` after status change inserts a row.

**Sequence + trigger** for `claim_ref`: yearly sequence; `BEFORE INSERT` trigger sets `CLM-YYYY-` + zero-padded 4-digit number.

**RLS**: all 4 tables enabled; admin-only via `has_role(auth.uid(), 'admin')` for SELECT/INSERT/UPDATE/DELETE (matches existing pattern, e.g. `bicycle_inspections`).

**Storage bucket** `claim-evidence` (private). RLS on `storage.objects` restricts read/write to admins only.

### Service layer — `src/services/claimsService.ts`
Functions: `listClaims(filters)`, `getClaim(id)`, `createClaim(payload)`, `updateClaim(id, patch)`, `changeStatus(id, newStatus, note?)`, `addNote(id, note)`, `uploadEvidence(id, file, label, kind)`, `listEvidence(id)`, `deleteEvidence(fileId)`, `getStatusLog(id)`, `getClaimsStats()` (returns counts + month settled total + avg days to resolution).

### UI components

**`src/pages/ClaimsList.tsx`**
- Header: title + green `+ New Claim` button (links to `/claims/new`)
- Stats bar: 4 `StatsCard`s — Open Claims, Awaiting Response (= awaiting_info count), Settled This Month (£), Avg Days to Resolution
- Search input (booking ref / customer / bike)
- Filter chip row: All | Open | Under Review | Awaiting Info | Settled | Rejected | Closed (toggle buttons)
- Table: Claim ID · Booking Ref · Customer · Bike · Damage Type · Date Opened · Status pill · Settlement £ · View. Row click and View button both navigate to `/claims/:id`.

**`src/components/claims/ClaimStatusBadge.tsx`** — coloured pill per status (blue/amber/purple/teal/green/red/grey).

**`src/pages/NewClaim.tsx`**
- Single scrolling form, react-hook-form + zod validation.
- Sections A–E exactly per spec (Booking, Bike, Damage, Evidence checklist, Internal Notes).
- Live timeframe flag: computes gap between `delivery_date` (or scheduled date for non-delivery) and `notification_date`, shows green tick or red warning inline (does not block).
- Bottom buttons: `Save as Draft` (status `open`, `internal_notes` only) and `Open Claim` (full payload, status `open`). Both redirect to `/claims/:id` after insert.

**`src/pages/ClaimDetail.tsx`** — split layout
- Left sticky panel: claim ref, big `ClaimStatusBadge`, booking ref, customer, bike, declared value, date opened, days open (computed), vertical timeline strip from `claim_status_log`.
- Right panel `Tabs`:
  - **Details** — same fields as new claim form, editable inline; `Save` button appears on dirty.
  - **Evidence** — checklist toggles (auto-saved), photo grid + upload (`Input type=file` to Supabase Storage `claim-evidence/{claim_id}/...`), document attachments list, label field per upload.
  - **Assessment** — claim_kind toggle, assessor fields, repair quote, market value, betterment toggle/amount/reason, computed cap = `min(repair_quote, market_value, declared_value)` shown read-only with "Recommended settlement" prefilled; manual override requires reason text.
  - **Settlement** — offer amount/date, accepted radio, payment ref, notes; if `offer_amount >= declared_value`, show `Title Transfer` checkbox with confirmation note.
  - **Notes & History** — chronological merged feed of `claim_notes` + `claim_status_log` (timestamps + author), add-note input + button.
- Contextual action buttons (top-right of detail) per status table in spec; each calls `changeStatus()`. `Make Settlement Offer` opens a small modal capturing offer amount + date before transitioning to `offer_made`.

### Verification
- Admin lands on `/claims` → sees stats, empty table, can create a claim → claim appears with `CLM-2026-0001` ref.
- Filter chips and search narrow the table.
- Open claim → status badge, timeline, all 5 tabs render. Edit fields, upload a photo, add a note, change status → audit log entry appears.
- Non-admin hitting `/claims` is redirected by `ProtectedRoute`.
- Notification timeframe: visible damage with gap > 48h shows red warning; ≤48h shows green tick.
- Settlement cap auto-calculates and is overridable with reason.
