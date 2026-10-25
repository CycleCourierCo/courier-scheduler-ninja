# Fleet Management module — inspections, defects, maintenance and repairs

## What already exists, and what gets reused

- **Vehicles** (15 vans). This stays the only vehicle record. It already holds registration, make, fuel, year, purchase date and mileage, tax and MOT from the DVLA (refreshed daily), status, notes and bike spaces.
- **Insurance policies.** Already managed on the Vehicles page. These are reused as they are, not copied.
- **Service history and service schedules.** These already exist (1 history entry so far). They will be extended into the full maintenance planner, not replaced.
- **Van issues** (0 rows, added today). This becomes the defect register.
- **Manual mileage readings** (added today). Extended into the full mileage history.
- **Timeslip mileage.** Kept as an estimate only. It is shown as "estimated since last reading" and never saved as a real reading.
- **Van unavailability.** Already used by route planning. "Out of service" will show beside it, but nothing is blocked automatically.
- **Roles.** The existing admin and fleet manager roles and the route permissions page are used. No new sign-in system.
- **Internal email reports and the Email Centre.** Reused for fleet alerts. No new notification service.
- **Private file storage.** A new private "fleet-documents" area follows the same pattern as the existing inspection reports.
- **Where vans get picked:** the route generator's van selection, timeslip creation, bulk vehicle assignment and trunk runs. Warnings go into these four places only.

## Phases (each one finished and checked before the next)

**Phase 1 — Foundation**
- A Fleet section in the menu with these pages: Dashboard, Vehicles, Defects, Maintenance, Repairs, Compliance. The existing Vehicles page stays as the vehicle list.
- A vehicle profile page (`/fleet/vehicles/:id`) with these tabs: Overview, Inspections, Defects, Maintenance, Tyres, Repairs, Mileage, Documents, History.
- Missing vehicle fields are added: model, VIN, vehicle type, assigned driver, maintenance notes and next planned inspection.
- Statuses are relabelled for fleet use, as below. Every status change is recorded automatically.
- A fleet dashboard with summary cards. Each card links to its filtered list. Figures come only from real records.

**Phase 2 — Inspections and defects**
- Five inspection types, each with its own checklist that admins can edit. The starting checklists are the ten groups from the brief (tyres to general condition, including bicycle racking).
- Each check is answered Pass, Fail, Not applicable or Not checked. Fail and Not checked need a reason. Tyre checks record tread depth (mm) for each tyre.
- Inspections can be saved as drafts. Once finalised they are locked. A correction creates a new linked version with the reason, and the original is kept.
- A failed check can be turned into a defect in one tap, with its details carried over.
- Detailed mechanical checks need the name of the garage or competent inspector. They are clearly labelled as separate from the weekly visual check.
- Defects get Red, Amber or Green severity, the eight statuses from the brief, assignment, photos and documents.
- A Red defect can't be closed without rectification evidence and the name of the person who verified it.

**Phase 3 — Maintenance and repairs**
- Each van gets its own maintenance schedule, using the full list of categories. A date limit, a mileage limit or both can apply, and an item is flagged when either is reached.
- Completing an item adds a history record and rolls the schedule forward.
- Mileage history records the source and the person recording it. A reading lower than the last one needs a reason and is flagged in the audit trail.
- A tyre register per position: fitted, inspected, replaced, cost and supplier. Admins can change the warning thresholds; the default warning is at 3mm, and anything under the legal 1.6mm shows red.
- Repair jobs can be created from a defect, a maintenance item or ad hoc. They go through the ten-step workflow from the brief, with quoted, labour, parts, VAT and final cost, plus an invoice attachment and verification.
- A basic list of garages and repair providers.
- A cost summary built only from repair job and maintenance history costs. Each repair is counted once, even when it is linked to both a defect and a maintenance item. Costs can be exported to CSV.
- Reminder thresholds can be configured (by default 30 days, 7 days, on the due date, and a mileage margin).

**Phase 4 — Route warnings and compliance**
- Warnings appear wherever a van is picked. A red banner shows for a critical defect or an out-of-service van. Amber shows for overdue servicing or an overdue inspection, and a grey notice for other open actions. The wording follows the brief, and each warning links to the van's open issues.
- Warnings never block anything, never change the chosen van, and each issue appears only once per screen. If someone continues past a red warning, that acknowledgement is recorded.
- The compliance page covers inspections due, overdue, completed and failed; defects by severity; outstanding repairs; maintenance due and overdue; and MOT, tax and insurance expiries taken from the existing records.
- The weekly inspection frequency is configurable.
- Fleet alerts are emailed to fleet managers: a new critical defect, a defect assignment, a repair awaiting verification, and a daily list of overdue repairs, maintenance and inspections. They can be edited in the Email Centre.

**Phase 5 — Testing**
- Automated tests for the business rules: due by date or mileage, falling-mileage rejection, tyre thresholds, no double-counted costs, and Red defects needing evidence before closure.
- Access checks: an admin and a fleet manager can use the module; a driver and a route planner can't see fleet records. Route planners only see the warning summary.
- Checks of the inspection, defect, repair and warning flows in the app, and confirmation that route generation and timeslips still work.

## Status mapping (keeps existing values)

```text
Operational                      -> in_use
Operational - maintenance req.   -> new value: in_use_maintenance_required
Under repair                     -> in_repair / in_service
Out of service                   -> off_road
Retired                          -> sold / written_off
(purchased, in_prep, mot_due, awaiting_sale, reserved keep working)
```

## Technical details

- **New tables:** fleet_inspection_templates, fleet_inspection_template_items, fleet_inspections (with draft/final and a supersedes link), fleet_inspection_results, fleet_repair_providers, fleet_repair_jobs, fleet_tyres, fleet_tyre_events, fleet_documents, fleet_audit_log, fleet_settings, fleet_route_warning_acks.
- **Extended tables:**
  - vehicle_issues becomes the defect register. New fields: category, source, inspection link, mileage, assignee, required action, provider, target and completed dates, verification and status.
  - vehicle_maintenance_intervals becomes the maintenance plan. New fields: category, description, last done, next due, reminder thresholds, estimated cost, priority, provider and status.
  - vehicle_maintenance_logs becomes the completed history, linked to its plan item and repair.
  - vehicle_odometer_readings gets the reading time, source, exception reason and links.
  - vehicles gets model, vin, vehicle_type, assigned_driver_id, maintenance_notes and next_inspection_due.
- **Enum change:** vehicle_service_type gets the new categories, and vehicle_status gets `in_use_maintenance_required`. Values are added only; nothing is removed or renamed.
- **Access:** every new or extended table uses the existing `is_fleet_staff()` check, so only admin and fleet manager get in. Audit log entries can be read but not edited or deleted, and they are written by database triggers.
- **Warning summary:** a new `fleet_vehicle_warnings(vehicle_ids)` database function returns only the warning level and a reason code per van. Only the roles that pick vans can call it: admin, fleet manager, route planner and timeslip admin. It returns no defect details.
- **Atomic saves:** finalising an inspection, closing a defect and completing a repair each run as one database function. All the related records save together, and the validation runs on the server.
- **Daily reminders:** a new `fleet-daily-reminders` background job runs every morning, protected by the existing cron secret, and sends through send-email.
- **Documents:** the new private `fleet-documents` storage area only lets admins and fleet managers read or upload.
- **Shared logic:** the due-date and threshold rules live in `src/lib/fleet/*.ts`, with tests alongside them.

## Out of scope

- Driver-facing inspection screens. The data structure leaves room for a future driver app (driver id, timestamp, photos), but no driver access changes now.
- Hard blocking of van assignment.
- Changes to the DVLA refresh, the insurance records or existing timeslip pay.

## Open point

- Phase 1 is delivered first for review, with each later phase after approval. This follows the brief's controlled rollout rather than one large change.
