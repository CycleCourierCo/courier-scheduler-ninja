## Answer first

That requirement kills the iframe idea. If a standalone workshop must be able to inspect a bike, log faults and record repairs **without any courier job**, then faults have to be a **first-class native feature of InspectaBike**, not a portal panel bolted in. So the model flips:

- **InspectaBike owns the fault record and service history** — natively, standalone, for every workshop.
- **The courier portal is one optional "connected account"** on top of that: when an inspection is linked to a courier order, faults sync into the portal so pricing, customer approval and invoicing run through your existing flow, and the approval result syncs back.
- Faults are still **entered once** — in InspectaBike — so no mechanic duplicates work. Pricing isn't duplicated either, because the two catalogues share a `repair_id` key (below).

## Two modes, one fault model

```text
STANDALONE (any workshop, no courier link)
  InspectaBike inspection -> faults (own catalogue + own hourly rate)
  -> mechanic marks repaired -> service history entry
  Approval: workshop's own simple approve/decline on the fault. Done.

CONNECTED (inspection created from a courier order)
  InspectaBike inspection -> faults (same UI, same catalogue)
        --sync-->  portal inspection_issues (priced by portal labour_times
                   + workshop_settings, since it's your job & your rates)
        <--sync--  customer approval / decline, parts ordered, parts arrived
  Mechanic repairs in InspectaBike -> repaired event -> portal issue resolved
  -> service history entry in InspectaBike
```

A fault in InspectaBike always carries `courier_issue_id` (null when standalone). Everything portal-specific hangs off that being present — so standalone workshops never see courier concepts, and a bike can move between the two over its life with one continuous history.

## The catalogue: shared `repair_id`

Your `labour_times` table already has a stable `repair_id` per repair. InspectaBike gets its own `repair_catalogue` table **seeded from that same list with the same `repair_id` values**, plus a per-organisation `hourly_rate` / `min_charge` (mirroring your `workshop_settings` formula). That gives:

- Standalone workshops: a full catalogue and their own prices out of the box.
- Connected jobs: the fault arrives in the portal with a `repair_id` you already know, so the portal prices it with **your** rates via existing `calculateLabourPrice` — no trust in the workshop's numbers, no re-picking the repair.
- Custom/one-off faults: free-text with no `repair_id`, and the portal flags those for manual pricing exactly as it does now.

## Part 1 — spec for bike-checker-pro (paste into that project)

- `bikes` table keyed on normalised `serial_number` (make/model/type/year) so every inspection, fault and service entry rolls up to one bike for life.
- `repair_catalogue` (`repair_id`, name, category, subcategory, bike_type, labour_minutes) + `workshop_rates` per organisation.
- `bike_faults`: `bike_id`, `inspection_id`, `organisation_id`, `repair_id` (nullable), description, parts/labour price, `status` (reported → approved/declined → awaiting_part → repaired), `courier_issue_id` (nullable, unique), timestamps + `mechanic_name`.
- `bike_fault_events`: append-only `fault_id`, `event`, `occurred_at`, `actor_name`, `detail` — the "when was it fixed" trail.
- `service_history`: one row per completed visit — date, workshop, mechanic, work done, faults resolved, total.
- `inspections`: add `courier_order_id`, `courier_tracking_number`.
- UI: a **Faults** section on the inspection (repair picker over `repair_catalogue`, auto price, parts/labour split, mark repaired), a **Faults** tab on the report, and a **Bike history** view by serial (feeds the existing `/check-serial`) — all working with zero courier involvement.
- Functions: `courier-create-inspection` (API-key verified, creates a linked inspection from a courier order) and outbound `courier-fault-sync` (HMAC-signed, fires on every fault create/update/repair when `courier_order_id` is set).

## Part 2 — courier portal (this project)

**Database (one migration)**
- `bicycle_inspections`: `external_provider`, `external_inspection_id`, `external_report_url`, `external_sent_at`, `external_completed_at` (+ index).
- `inspection_issues`: add `external_fault_id` (unique-ish, for idempotent sync) and `external_synced_at`.

**Secrets:** `INSPECTABIKE_API_KEY`, `INSPECTABIKE_BASE_URL`, `INSPECTABIKE_SYNC_SECRET`.

**Edge functions**
- `inspectabike-create-job` (staff JWT): creates/fetches the linked InspectaBike inspection for an order (make/model/type/**serial**/customer + order + tracking number), stores its id and report URL. Idempotent.
- `inspectabike-fault-webhook` (public, HMAC-verified, CORS, no PII in logs): receives fault create/update/repair events; upserts `inspection_issues` on `external_fault_id`; **prices from `labour_times` + `workshop_settings` using `repair_id`**, ignoring any inbound price; faults with no `repair_id` land as pending manual pricing. Repaired events resolve the issue.
- `inspectabike-push-status` (background via `EdgeRuntime.waitUntil`): pushes portal-side changes back — customer approved/declined, parts ordered, parts arrived — so the mechanic sees them in InspectaBike without leaving it.

**Frontend**
- `src/pages/BicycleInspections.tsx`: "Send to InspectaBike" button, linked-status badge, "View report" and "Bike history" links; imported faults tagged as InspectaBike-sourced.
- Order detail: report + lifetime-history links beside inspection details.
- Customer approval, parts tracking, invoicing, workshop schedule: unchanged — they operate on the same `inspection_issues` rows as today.

## Sequencing

1. Portal side (migration, three edge functions, UI) — I build here.
2. I hand you a verbatim spec to paste into bike-checker-pro for its native faults + history + the two sync functions.
3. Seed InspectaBike's `repair_catalogue` from your `labour_times` export so `repair_id`s match on day one.

Say go and I'll start with the portal side.
