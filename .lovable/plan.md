# Van servicing fixes, bulk servicing, fleet-wide intervals

## What is going wrong today
Talha's records did save (tyres on several vans, oil & filter on 4+ vans, all dated today). The "Mileage & servicing" card looks unchanged because:
1. Items that have never been logged show "Due soon" — the tyres/brakes still listed are the positions he did not log, which reads like nothing updated. Items he did log drop off the list with no confirmation.
2. Almost every record was saved without a mileage, so the next-due mileage can't be worked out.
3. The card's "Current odometer" uses the old formula (purchase baseline + timeslip miles) and ignores manual mileage readings, unlike the rest of Fleet.
4. A mileage typed on a service record never updates the van's odometer.

## Fixes
- Card shows every tracked item with last done date/mileage and next due ("Due 26 Apr 2027 or 253,819 mi"). Never-done items show "No record" (grey), not "Due soon".
- Odometer on the card uses the shared fleet odometer rule (newest manual reading + later timeslip miles).
- Service form pre-fills mileage with the current odometer; if staff enter a mileage, it's also saved as a manual mileage reading so the van's odometer updates.
- Records with no mileage fall back to the van's odometer on that date for next-due mileage.

## Bulk servicing (Fleet vehicles list)
- Checkbox per van + "Select all", and an "Add service to selected" button.
- One dialog: service type, position (tyres/brakes), date, garage, cost per van, notes, optional brand/model.
- Mileage per van listed in the dialog, pre-filled with each van's current odometer and editable.
- Saved in one go for all selected vans; result shows how many saved.

## Fleet-wide service intervals
- New "Default service intervals" page/tab in Fleet (admin & fleet manager): miles and months per service type (and per position where relevant).
- These apply to every van. A van can still have its own override; the van page shows "Using fleet default" or "Custom for this van" with a "Reset to default".
- Built-in defaults stay as the fallback if nothing is set.

## Technical details
- New table `fleet_service_interval_defaults` (service_type, position, custom_name, interval_miles, interval_months), grants + RLS via `is_fleet_staff`, audited by fleet_audit_trigger. Order of precedence in `computeNextDue`: vehicle override > fleet default > DEFAULT_INTERVALS.
- `computeNextDue` takes the shared odometer from `src/lib/odometer.ts`; add "unknown/no record" status instead of amber for never-done.
- Bulk insert into `vehicle_maintenance_logs` via a single `fleet_bulk_log_service` security-definer function (role-checked, one transaction, also inserts odometer readings when mileage given).
- Vitest: precedence of intervals, never-done status, odometer fallback.
