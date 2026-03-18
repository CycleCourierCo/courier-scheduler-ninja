

## Fix: Enforce Region Exclusivity Per Driver Slot + Allowed Region Combos

### Problem

The fallback heuristic (and AI prompt) doesn't enforce that a driver slot is "locked" to a region once it starts filling. The Priority 3 logic (line 755-775) looks for any empty or same-region slot, but if the region's existing slot is full, it grabs any empty slot — even one already claimed by a different region on the same day. Result: Wales + East on the same slot.

The AI prompt lists allowed combos but doesn't forbid ALL other combos strictly enough.

### Solution: `supabase/functions/predict-routes/index.ts`

#### 1. Define allowed region combinations as a strict allowlist

```
ALLOWED_COMBOS = {
  'North West': ['North East'],           // can merge if low volume
  'North East': ['North West'],
  'London': ['East', 'South East', 'South West Coastal'],
  'East': ['London'],
  'South East': ['London'],
  'South West Coastal': ['London'],
  'South West Deep': [],                  // NEVER combine with anything
  'Wales': ['West Midlands'],
  'West Midlands': ['Wales', 'East Midlands'],
  'East Midlands': ['West Midlands'],
}
```

Add a helper: `canShareSlot(regionA, regionB) => regionA === regionB || ALLOWED_COMBOS[regionA]?.includes(regionB)`.

#### 2. Track which region(s) own each day/slot

Maintain a `slotRegionOwner: Map<string, Set<string>>` (key = `day_slot`). When assigning a stop:
- Check if the slot already has region(s) assigned
- Only allow the stop if `canShareSlot` returns true for ALL existing regions on that slot
- If no compatible slot exists, create a new slot on a new day

#### 3. Update fallback heuristic assignment logic

Replace the Priority 3 "find first available day/slot" block (lines 755-775) and the last-resort block (lines 778-791) to check `canShareSlot` before assigning. Never assign to a slot whose existing region is incompatible.

Same fix for delivery assignment (lines 858-898): when looking for an available slot, enforce region compatibility.

#### 4. South West Deep isolation

Since Devon/Cornwall jobs must NEVER be combined with other regions, the `ALLOWED_COMBOS['South West Deep']` is empty — the `canShareSlot` check will naturally prevent mixing.

#### 5. Update AI prompt rules (line 316-317)

Replace the vague "adjacent region combos that are OK" with the explicit allowlist:
- "Allowed combinations: NW+NE, London+East, London+SE, London+SW Coastal, Wales+West Midlands, West Midlands+East Midlands"
- "South West Deep (Devon/Cornwall) MUST NEVER be combined with any other region"
- "All other region combinations are FORBIDDEN"

#### 6. Add validation for region mixing

In `validateCriticalErrors`, add a check: for each day/slot, collect all regions present. If any pair fails `canShareSlot`, flag as critical error. This catches AI violations too.

### Expected Outcome

- Each driver slot contains stops from ONE region or an explicitly allowed combo
- Wales + East on the same slot is impossible
- Cornwall/Devon always gets its own dedicated slot
- NW + NE can merge when volumes are low
- London can absorb East, SE, or SW Coastal when needed

