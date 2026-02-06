

# Fix: Recalculate Using Fresh Coordinates Instead of Stale State

## Problem Identified

The console logs confirm coordinates ARE being fetched correctly:
```
Updated coordinates for Ryan Bourne : (51.64760187300901, -0.3790772348021238) -> (51.227579, -0.132259)
```

**However**, the `calculateTimeslots()` function still uses the **old** `selectedJobs` from React state because:

1. `setSelectedJobs(updatedJobs)` is called (line 1119)
2. `setTimeout(..., 100)` schedules `calculateTimeslots()` (line 1122-1124)
3. `calculateTimeslots()` reads `selectedJobs` from its closure (line 1128)
4. React's state update hasn't propagated yet, so it uses stale data

---

## Solution

Pass the updated jobs directly to `calculateTimeslots()` instead of relying on React state update timing.

---

## Implementation

### File to Modify

`src/components/scheduling/RouteBuilder.tsx`

### Change 1: Modify `calculateTimeslots` to accept optional jobs parameter

**Current (line ~1127):**
```typescript
const calculateTimeslots = async () => {
  if (selectedJobs.length === 0) return;

  // Group jobs by location first
  const groupedJobs = groupJobsByLocation(selectedJobs);
```

**Updated:**
```typescript
const calculateTimeslots = async (jobsToCalculate?: SelectedJob[]) => {
  // Use passed jobs or fall back to state
  const jobs = jobsToCalculate || selectedJobs;
  
  if (jobs.length === 0) return;

  // Group jobs by location first
  const groupedJobs = groupJobsByLocation(jobs);
```

### Change 2: Update `refreshAndCalculateTimeslots` to pass fresh jobs directly

**Current (lines ~1119-1124):**
```typescript
setSelectedJobs(updatedJobs);

// Small delay to ensure state is updated before calculating
setTimeout(() => {
  calculateTimeslots();
}, 100);
```

**Updated:**
```typescript
setSelectedJobs(updatedJobs);

// Pass the fresh jobs directly instead of relying on state update timing
calculateTimeslots(updatedJobs);
```

---

## Why This Works

| Before | After |
|--------|-------|
| `calculateTimeslots()` reads from stale `selectedJobs` state | `calculateTimeslots(updatedJobs)` receives fresh coordinates directly |
| 100ms timeout doesn't guarantee state update | No timing dependency |
| Coordinates fetched but not used | Coordinates fetched and immediately used |

---

## Data Flow After Fix

```text
User clicks "Recalculate"
         ↓
refreshAndCalculateTimeslots() runs
         ↓
Fetch fresh coordinates from Supabase
         ↓
Build updatedJobs with new lat/lon
         ↓
setSelectedJobs(updatedJobs)  ← Updates UI state
         ↓
calculateTimeslots(updatedJobs)  ← Uses fresh jobs directly
         ↓
Correct travel times calculated using NEW coordinates
```

---

## Summary

| Task | Description |
|------|-------------|
| Add optional parameter to `calculateTimeslots` | `(jobsToCalculate?: SelectedJob[])` |
| Use parameter or fallback to state | `const jobs = jobsToCalculate \|\| selectedJobs` |
| Remove setTimeout in `refreshAndCalculateTimeslots` | No longer needed |
| Pass fresh jobs directly | `calculateTimeslots(updatedJobs)` |

This ensures the freshly-fetched coordinates are used immediately for the calculation, rather than waiting for React state to update.

