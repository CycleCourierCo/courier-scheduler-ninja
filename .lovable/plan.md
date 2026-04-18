

## Fix Mechanic Permissions for Bicycle Inspections

### Root cause
RLS policies on `bicycle_inspections` and `inspection_issues` only allow `admin` (and order owners for SELECT). The `mechanic` role is completely missing, so for mechanics:
- The inspection record can't be SELECTed → status badge always falls back to "Awaiting Inspection" and existing issues/notes don't display (this is the "status not showing" the user noticed).
- Cannot INSERT a new inspection record → "Start Inspection" silently fails (`getOrCreateInspection` returns null).
- Cannot UPDATE inspections → can't mark as inspected, move to in_repair, or repaired.
- Cannot INSERT/UPDATE inspection_issues → can't report or mark issues repaired.

UI already grants mechanics access (`canManageInspections = isAdmin || isMechanic` in `BicycleInspections.tsx`), but the database blocks every write.

### Fix — single SQL migration

Add `mechanic` to the relevant RLS policies (alongside existing `admin` checks):

```text
bicycle_inspections:
  SELECT  → admin OR mechanic OR order owner
  INSERT  → admin OR mechanic
  UPDATE  → admin OR mechanic

inspection_issues:
  SELECT  → admin OR mechanic OR order owner
  INSERT  → admin OR mechanic
  UPDATE  → admin OR mechanic OR order owner (customer keeps approve/decline)
```

DELETE remains admin-only.

Also confirm mechanics can SELECT the underlying `orders` rows they need. The existing `orders_authenticated_public_select_policy` (any authenticated user where `tracking_number IS NOT NULL`) already covers them, so no orders policy change needed.

### What this fixes
- Inspection status badges (Issues Found / In Repair / Repaired) will display for mechanics.
- Existing issues, notes, inspector name, etc. will show on mechanic cards.
- "Start Inspection" checklist will save successfully.
- Mechanic can mark issues, mark them repaired, and move bikes through the workflow.

### About the storage location badge
The location pill (e.g. "A12") difference between the two screenshots is just because those are different orders — one has `storage_locations` set, the other doesn't. No code change needed; once a bike has been allocated to a bay it will show for mechanics too (the `storage_locations` column is on the orders row mechanics can already read).

### Files / changes
- One new migration adding/replacing the six RLS policies above.
- No frontend code changes required.

### Verification after deploy
- Log in as mechanic, open Bicycle Inspections → previously hidden status badges (Issues Found, In Repair, Repaired) should now appear on the relevant cards.
- Click "Start Inspection" on an awaiting bike, complete the checklist with no issues → bike should move to "Inspected & Serviced".
- Repeat with one issue added → bike should move to "Issues" tab.
- After customer responds, mechanic should be able to mark the issue repaired and complete repairs.

