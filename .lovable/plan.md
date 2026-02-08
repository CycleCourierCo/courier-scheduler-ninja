

## Load All Matched Jobs from Route Comparison

A simple change to load ALL matched jobs (not just viable ones) when clicking "Load Route" in the comparison dialog.

---

## Changes Required

### 1. Update Route Loading Handler

**File:** `src/components/scheduling/RouteBuilder.tsx`

Change line 956 from using `viableMatchResults` to `matchResults`:

| Before | After |
|--------|-------|
| `analysis.viableMatchResults` | `analysis.matchResults.filter(r => r.matchedOrder && r.jobType)` |

---

### 2. Update Button Text and Enable Logic

**File:** `src/components/scheduling/RouteComparisonDialog.tsx`

| Current | Updated |
|---------|---------|
| `disabled={analysis.viableJobs === 0}` | `disabled={analysis.totalMatched === 0}` |
| `Load {analysis.viableJobs} Jobs` | `Load {analysis.totalMatched} Jobs` |

---

## Files to Modify

| File | Line(s) | Change |
|------|---------|--------|
| `src/components/scheduling/RouteBuilder.tsx` | 956 | Use `matchResults` instead of `viableMatchResults` |
| `src/components/scheduling/RouteComparisonDialog.tsx` | 133, 138 | Update disabled condition and button text to use `totalMatched` |

---

## Expected Behavior

When clicking "Load Route":
- Loads ALL matched jobs from the CSV, including those that are not viable
- Button shows total matched count (e.g., "Load 12 Jobs")
- Button is disabled only if no jobs were matched at all
- Viability stats remain visible for reference (user can still see which jobs have issues)

