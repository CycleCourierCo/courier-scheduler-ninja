

# Admin-Triggered Inspection Status Reconciliation

## Overview

Instead of giving customers UPDATE permissions on `bicycle_inspections`, we'll create a reconciliation function that runs when an admin opens the inspections page. This function will find all inspections stuck in `issues_found` status where the customer has already responded to all issues, and move them to `in_repair`.

---

## Solution Approach

When an admin loads the Bicycle Inspections page:
1. A reconciliation function runs automatically
2. It finds all inspections with `status = 'issues_found'`
3. For each, checks if all issues have been addressed (approved/declined/repaired/resolved)
4. If yes, updates the inspection status to `in_repair`
5. Only admins can trigger this (they have UPDATE permission via RLS)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/inspectionService.ts` | Add `reconcileInspectionStatuses()` function, remove auto-check from accept/decline |
| `src/pages/BicycleInspections.tsx` | Call reconciliation when admin loads page |

---

## Implementation Details

### 1. New Service Function (`inspectionService.ts`)

```typescript
// Reconcile inspection statuses - moves issues_found to in_repair when all issues addressed
// This runs when an admin opens the inspections page
export const reconcileInspectionStatuses = async (): Promise<number> => {
  try {
    // Get all inspections in 'issues_found' status with their issues
    const { data: inspections, error } = await supabase
      .from('bicycle_inspections')
      .select('id, status, inspection_issues(status)')
      .eq('status', 'issues_found');

    if (error) throw error;
    if (!inspections || inspections.length === 0) return 0;

    let updatedCount = 0;

    for (const inspection of inspections) {
      const issues = inspection.inspection_issues as { status: string }[];
      
      // Check if all issues have been responded to
      const allResolved = issues.length > 0 && issues.every(
        issue => ['approved', 'declined', 'repaired', 'resolved'].includes(issue.status)
      );

      if (allResolved) {
        const { error: updateError } = await supabase
          .from('bicycle_inspections')
          .update({ status: 'in_repair' })
          .eq('id', inspection.id);

        if (!updateError) {
          updatedCount++;
        }
      }
    }

    return updatedCount;
  } catch (error) {
    console.error('Error reconciling inspection statuses:', error);
    return 0;
  }
};
```

### 2. Remove Auto-Check from Customer Actions

In `acceptIssue` and `declineIssue` functions, remove the call to `checkAndMoveToInRepair()` since it won't work due to RLS anyway:

**Before:**
```typescript
if (data) {
  await checkAndMoveToInRepair(data.inspection_id);
}
```

**After:**
```typescript
// Status reconciliation happens when admin views the page
// (removed checkAndMoveToInRepair call - customer doesn't have UPDATE permission)
```

### 3. Call Reconciliation on Admin Page Load (`BicycleInspections.tsx`)

Modify the query to call reconciliation before fetching when admin:

```typescript
const { data: inspections = [], isLoading } = useQuery({
  queryKey: ["bicycle-inspections", isAdmin, user?.id],
  queryFn: async () => {
    if (isAdmin) {
      // Reconcile any stuck inspections before fetching
      await reconcileInspectionStatuses();
      return getPendingInspections();
    } else if (user?.id) {
      return getMyInspections(user.id);
    }
    return [];
  },
  enabled: !!user,
});
```

---

## Data Flow

```text
Customer responds to issues:
─────────────────────────────────────────────────
Customer clicks "Accept" or "Decline"
    ↓
Issue status updated (approved/declined)
    ↓
Inspection remains in "issues_found" status
    ↓
(No status change - customer lacks UPDATE permission)

Admin opens inspections page:
─────────────────────────────────────────────────
Admin navigates to /bicycle-inspections
    ↓
reconcileInspectionStatuses() runs
    ↓
Finds inspections where all issues addressed
    ↓
Moves them to "in_repair" status
    ↓
Data refreshes with correct statuses
```

---

## Security Benefits

| Aspect | Before | After |
|--------|--------|-------|
| Who can update inspection status | Attempted by customer (failed due to RLS) | Only admins |
| Attack surface | Would need customer UPDATE policy | No new policies needed |
| Control | Automatic (tried to run on customer action) | Explicit (runs on admin page load) |

---

## Immediate Fix for Existing Data

When you approve the plan and I implement it, the next time an admin opens the Bicycle Inspections page, the stuck inspection (`2f7acfe5-610a-4138-879d-d4be8abfc46a`) will automatically move to `in_repair` status.

---

## Summary

| Task | Description |
|------|-------------|
| Add `reconcileInspectionStatuses()` | New function to find and fix stuck inspections |
| Remove customer auto-check | Remove `checkAndMoveToInRepair` calls from accept/decline |
| Call on admin page load | Reconcile before fetching inspection data |

