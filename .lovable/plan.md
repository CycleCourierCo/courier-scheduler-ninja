# Equipment Tracking

A new internal section to track reusable kit — van racking, wheel adapters, straps, boxes — with pooled quantities, per-unit serials, current assignment, and maintenance/inspection due dates.

## What you get

**Equipment page (`/equipment`)** under the Fleet section of the menu, with three tabs:

1. **Equipment types** — the pool view. One row per kind of kit (e.g. "Wheel adapter", "Van racking – 6 bike"), showing total units, how many are available, assigned, in repair, or lost/retired. Add, edit and retire types here.
2. **Units** — the individual items inside each pool, each with its own serial/asset tag, condition, current assignment and maintenance status. Filter by type, site, vehicle, status, and "maintenance due". Bulk-add units to a pool (generate N units, optionally with a serial prefix) so you don't have to enter 24 adapters one by one.
3. **Maintenance** — everything overdue or due in the next 30 days, plus a log of past checks. Log a check against a unit (date, who did it, pass/fail, notes, next due date).

**Assignment**: each unit is either at a site, with a vehicle (van), or with a person. Reassigning writes a movement history entry so you can see where a unit has been and who had it last.

**Detail drawer** for a unit: serial, condition, purchase date/cost, current assignment, movement history, maintenance history.

**Access**: admins, loaders and fleet managers can add, edit, move and log maintenance. Other internal staff (drivers, mechanics, route planners, sales, timeslip admin, CS agents, tech) get read-only. Customers get no access.

## Technical detail

### Database (one migration)

Enums: `equipment_unit_status` (`available`, `assigned`, `in_repair`, `lost`, `retired`), `equipment_condition` (`new`, `good`, `fair`, `poor`, `unusable`), `equipment_assignment_kind` (`site`, `vehicle`, `person`).

- `equipment_types` — name (unique), category, description, manufacturer, model, requires_maintenance bool, maintenance_interval_days, default_site_id → `sites`, is_active, timestamps.
- `equipment_units` — equipment_type_id → `equipment_types`, serial (nullable, unique per type), asset_tag, status, condition, assignment_kind, site_id → `sites`, vehicle_id → `vehicles`, assigned_to_user_id → `profiles`, purchase_date, purchase_cost, last_maintenance_at, next_maintenance_due, notes, timestamps.
- `equipment_movements` — unit_id, from/to assignment kind + ids, moved_by → `profiles`, moved_at, notes.
- `equipment_maintenance_logs` — unit_id, performed_at, performed_by → `profiles`, result (`pass`/`advisory`/`fail`), notes, next_due_at, cost.

Each table: GRANT `SELECT, INSERT, UPDATE, DELETE` to `authenticated` and `ALL` to `service_role` (no `anon` grants), then RLS enabled. Policies use the existing `has_role(auth.uid(), ...)` / `is_internal_staff(auth.uid())` helpers and follow the project's RLS performance model:

- Read: `is_internal_staff(auth.uid())`.
- Write: `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'loader') OR has_role(auth.uid(),'fleet_manager')`, with matching `WITH CHECK`.

Triggers: `update_updated_at_column()` on the two main tables; a trigger on `equipment_units` that recalculates `next_maintenance_due` from the type interval when `last_maintenance_at` changes, and one that writes an `equipment_movements` row whenever assignment fields change (attributing `moved_by` to `auth.uid()`).

### Frontend

- `src/types/equipment.ts` — types mirroring the tables.
- `src/services/equipmentService.ts` — CRUD for types/units, bulk unit creation, reassign, log maintenance, movement/maintenance history fetchers.
- `src/hooks/useEquipment.ts` — react-query hooks following the `useSites` / `useStorageBays` pattern.
- `src/pages/EquipmentPage.tsx` plus `src/components/equipment/` (`EquipmentTypesTab`, `EquipmentUnitsTab`, `EquipmentMaintenanceTab`, `EquipmentTypeDialog`, `AddUnitsDialog`, `AssignUnitDialog`, `LogMaintenanceDialog`, `UnitDetailDrawer`, `EquipmentStatusBadge`).
- Register the route in `src/App.tsx` and add a `equipment` entry to `src/config/routes.ts` (section `Fleet`, `defaultRoles: ["loader","fleet_manager","route_planner","sales","mechanic","driver","timeslip_admin","cs_agent","tech"]` — write actions gated in the UI by role in addition to RLS).

Mobile-first layout: cards on small screens, tables from `sm` up, consistent with existing admin pages. All colours via existing semantic tokens.

## Not included

No barcode/QR scanning, no purchase-order or depreciation reporting, no customer-facing view. Easy to add later if useful.
