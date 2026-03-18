

## Fix: Multi-Day Split for Cross-Region Orders

### Root Cause
In both `predict-routes` (v1) and `predict-routes-v2`, the rule is: "if collection and delivery are on the same day, they MUST be on the same driver slot." This is correct in principle, but when the collection region (e.g. South West Deep) and delivery region (e.g. North West) are incompatible, they still get jammed onto the same slot because nothing prevents them from landing on the same day.

### The Fix
**Force incompatible cross-region collection/delivery pairs onto different days.** If a delivery's region cannot share a slot with its collection's region (per `canShareSlot`), the delivery's minimum allowed day must be pushed to the day AFTER the collection day. This applies in 3 places across 2 files:

### Changes

#### 1. `supabase/functions/predict-routes/index.ts` — v1 fallback

In the delivery assignment loop (~line 915-980), after determining `minDay` from `collectionAssignment`, add a check: if the delivery's region is incompatible with the collection's region, set `minDay` to the day after the collection day. Also remove the "Priority 0" and "Priority 2" logic that forces same-day deliveries onto the collection's slot when regions are incompatible.

Update the AI prompt (rule 7, ~line 356-357) to add: "If a collection and delivery are in INCOMPATIBLE regions, they MUST be on DIFFERENT days."

#### 2. `supabase/functions/predict-routes-v2/index.ts` — v2 fallback

In `archetypeAwareFallback` (~line 810-818), same fix: when assigning a delivery and checking its collection's assignment, if the regions are incompatible, force a later day rather than using the collection's slot. Specifically, if `assignDay === coll.day` and the regions can't share a slot, bump `assignDay` to the next weekday.

Update the v2 AI prompt (~line 335) to add the same incompatible-region rule.

#### 3. Validation

The validation in both functions already catches "same-day collection and delivery on different driver slots" and "incompatible regions on same slot." No changes needed here — the fix prevents these from occurring in the first place.

### Files

| File | Change |
|---|---|
| `supabase/functions/predict-routes/index.ts` | Add cross-region day-split in fallback delivery assignment + update AI prompt |
| `supabase/functions/predict-routes-v2/index.ts` | Add cross-region day-split in `archetypeAwareFallback` + update AI prompt |

No database migration needed. No frontend changes needed.

