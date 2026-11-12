# Bay override, "Wrongly allocated" zone and "Allocated by" labels

## What you'll get
1. **Override an occupied bay** — when you allocate or scan a bike into a bay that the system says is taken, instead of just an error you get a popup: "Bay A2 shows *[customer / bike / tracking]* — it's not physically there? **Override**". Override needs a confirm tap.
2. **Wrongly allocated bikes** — the bike that was wrongly in that bay is taken out of the bay and moved into a new **Wrongly allocated** section on the Loading & Storage page (above Bikes in Storage). Each card shows where the system thought it was, who overrode it and when, with buttons to **Allocate to bay** (or scan it) or **Mark found / dismiss**. Once allocated to a real bay it leaves the section.
3. **"Allocated by" on every bike** — each bike in each bay (bay grid, Bikes in Storage list, order page storage box) shows a small label "By Talha · 11 Nov 14:02". Older allocations with no record show "By unknown".

Works the same from: the Loading page allocate dialog, the move-bay action, the order page storage box, and the scanner (scan bike → scan bay).

## Who can override
Same staff who can allocate bays today (admin, loader, CS, etc. via existing permissions). Every override is logged in the scan history (who, when, which bike was displaced).

## Technical details
- `orders.storage_locations` entries gain `allocatedBy` (user id) and `allocatedByName`; written by all allocation paths.
- New columns on `orders`: `misallocated_at`, `misallocated_from` (bay-slot text), `misallocated_by`. A bike is in the "Wrongly allocated" zone when `misallocated_at` is set and it has no bay.
- New role-checked database function `override_bay_allocation(p_order_id, p_bay, p_pos)`: takes the bay advisory lock, removes the slot from the occupying order(s), stamps their misallocated fields, allocates the new bike, writes `label_scans` rows (`bay_override` + `bay`). `label_scan_action('bay')` keeps rejecting occupied slots, but its error returns the occupant so the UI can offer override; it also records `allocatedBy`. Any new bay allocation clears `misallocated_*`. Functions REVOKE from PUBLIC/anon.
- Client: replace the three inline occupied checks (`LoadingUnloadingPage.tsx` ×2, `StorageLocation.tsx`) and scan-to-bay with a shared occupied→override dialog; new `WronglyAllocatedSection` component; "Allocated by" text in `StorageUnitLayout`, `BikesInStorage`, `StorageLocation`.
- Vitest: displaced bike lands in wrongly-allocated list; reallocation clears it; allocatedBy shown/fallback.
