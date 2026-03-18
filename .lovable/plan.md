

## Fix: Same-Day Same-Slot Constraint + Location Grouping

### Issue 1: Same-day collection and delivery split across different drivers

The validation at line 627 only checks `delivery.day < collection.day` — it misses the case where collection and delivery are on the **same day** but assigned to **different driver slots**, which is physically impossible (one driver can't hand the bike to another mid-day).

**Clarified rule**: Collection and delivery for the same order CAN be on different days with different drivers. But if they're on the **same day**, they MUST be on the **same driver slot**.

**Fix in `validateCriticalErrors` (line 626-629)**:
- Add check: if `g.collection.day === g.delivery.day && g.collection.driver_slot !== g.delivery.driver_slot`, flag as critical error.

**Fix in AI prompt (line 314)**:
- Add rule: "If collection and delivery for the same order are on the SAME day, they MUST be on the SAME driver_slot. They CAN be on different days with different drivers."

**Fix in fallback heuristic delivery assignment (lines 804-882)**:
- When assigning a delivery, check if its collection is on the same day. If so, force the delivery onto the same slot as the collection.

### Issue 2: Multiple orders at the same location not grouped

Newport Cycling Repair has a delivery for one order AND a collection for a different order. These are different `dependency_group`s but at the same physical location. Currently nothing groups stops by location.

**Fix: Add location-based grouping**:
- Before the AI call and in the fallback, identify stops that share the same contact name + postcode (or are within ~0.5km of each other).
- Add a `location_group` field to the stop abstraction passed to the AI.
- Update the AI prompt with rule: "Stops in the same `location_group` (same physical location, different orders) SHOULD be assigned to the same driver_slot and day when possible."
- In the fallback heuristic, when assigning a stop, check if any other stop at the same location has already been assigned. If so, prefer that same day/slot.

### Files Changed

**`supabase/functions/predict-routes/index.ts`** — all fixes in one file:

1. Add `location_group` computation after stop expansion (group by contact_name + postcode_prefix)
2. Include `location_group` in stop abstractions sent to AI
3. Add AI prompt rules for same-day/same-slot and location grouping
4. Update `validateCriticalErrors` to flag same-day different-slot assignments
5. Update fallback heuristic to respect location grouping and same-day slot constraints

