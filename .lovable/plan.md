

## Quick status change + extra van statuses

### New statuses (added to existing 5)

The current set is: Purchased, In Prep, In Use, Sold, Off Road. I'd suggest adding these common van fleet states:

- **In Service** — booked in for routine servicing/tyres at a garage.
- **In Repair** — broken down / awaiting parts (distinct from planned service).
- **MOT Due** — flagged for upcoming MOT (lets you filter the fleet quickly).
- **Awaiting Sale** — listed for sale but not yet sold (between "in use" and "sold").
- **Written Off** — insurance write-off (distinct from "sold").
- **Reserved** — assigned to a specific driver/route, not in the general pool.

Each gets its own coloured badge in `VehicleStatusBadge.tsx` (e.g. service = sky, repair = orange, MOT due = yellow, awaiting sale = violet, written off = rose, reserved = teal).

I'll ask below which of these you actually want — no point cluttering the dropdown with statuses you won't use.

### Quick "Change status" button on each row

On every vehicle row (and mobile card), add an inline status control so you don't have to open the Edit dialog:

- Replace the static badge cell with a compact **DropdownMenu** triggered by the badge itself (looks like the badge, click → menu of all statuses with a tick next to current).
- Picking a status calls `updateVehicle(id, { status })` immediately, optimistically updates the row, and shows a toast "AB12 CDE → In Prep".
- Keeps the Edit pencil for full edits (notes, dates, toggles).

Mobile: same pattern — tap the badge to change.

### Files

**Schema (migration)**
- Extend the `vehicle_status` enum with the chosen new values (`ALTER TYPE ... ADD VALUE`).

**Code**
- `src/services/vehicleService.ts` — add new entries to `VEHICLE_STATUS_OPTIONS`.
- `src/components/vehicles/VehicleStatusBadge.tsx` — colour classes + labels for new values.
- `src/pages/VehicleManagement.tsx` — wrap badge in `DropdownMenu`; add `handleStatusChange(v, status)` with optimistic update + toast; reuse on desktop row + mobile card.

### Verification

- Click the badge on a row → menu lists all statuses with current one ticked → pick one → row updates immediately, toast confirms, no dialog opens.
- Filter dropdown at the top includes all new statuses.
- Refresh the page → status persisted.

### One question before I build

Which of the suggested extra statuses do you actually want? (Pick any combo — see the question below.)

