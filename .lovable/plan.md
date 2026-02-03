

# Add "In Repair" and "Repaired" Statuses with Enhanced Workflow

## Overview

This plan adds two new inspection statuses (`in_repair` and `repaired`) to create a complete repair workflow. It also renames the existing "inspected" status to "inspected with no issues" for clarity.

---

## New Workflow

```text
Awaiting Inspection
        ↓
    [Admin inspects bike]
        ↓
   ┌────┴────┐
   ↓         ↓
No Issues   Issues Found
(inspected)  (issues_found)
   ↓              ↓
   │    [Customer responds to ALL issues]
   │              ↓
   │         In Repair
   │         (in_repair)
   │              ↓
   │    [Admin marks approved issues as repaired]
   │              ↓
   │          Repaired
   │          (repaired)
   │              ↓
   └──────────────┘
        Done
```

---

## Changes Required

### 1. Type Updates (`src/types/inspection.ts`)

Add new statuses to `InspectionStatus`:

**Current:**
```typescript
export type InspectionStatus = 'pending' | 'inspected' | 'issues_found';
```

**Updated:**
```typescript
export type InspectionStatus = 'pending' | 'inspected' | 'issues_found' | 'in_repair' | 'repaired';
```

Add new status to `IssueStatus` for tracking repaired issues:

**Current:**
```typescript
export type IssueStatus = 'pending' | 'approved' | 'declined' | 'resolved';
```

**Updated:**
```typescript
export type IssueStatus = 'pending' | 'approved' | 'declined' | 'resolved' | 'repaired';
```

---

### 2. Service Layer Updates (`src/services/inspectionService.ts`)

Add new functions:

**Move to "In Repair" status:**
```typescript
export const moveToInRepair = async (inspectionId: string): Promise<BicycleInspection | null> => {
  const { data, error } = await supabase
    .from('bicycle_inspections')
    .update({ status: 'in_repair' as InspectionStatus })
    .eq('id', inspectionId)
    .select()
    .single();
  // ...
};
```

**Mark issue as repaired (admin action):**
```typescript
export const markIssueRepaired = async (
  issueId: string,
  repairerId: string,
  repairerName: string
): Promise<InspectionIssue | null> => {
  const { data, error } = await supabase
    .from('inspection_issues')
    .update({
      status: 'repaired' as IssueStatus,
      resolved_at: new Date().toISOString(),
      resolved_by_id: repairerId,
      resolved_by_name: repairerName,
    })
    .eq('id', issueId)
    .select()
    .single();
  // ...
};
```

**Move to "Repaired" status:**
```typescript
export const moveToRepaired = async (inspectionId: string): Promise<BicycleInspection | null> => {
  const { data, error } = await supabase
    .from('bicycle_inspections')
    .update({ status: 'repaired' as InspectionStatus })
    .eq('id', inspectionId)
    .select()
    .single();
  // ...
};
```

**Check if all issues are resolved by customer:**
```typescript
export const checkAllIssuesResolved = (issues: InspectionIssue[]): boolean => {
  // All issues must have a status of 'approved' or 'declined' (customer responded)
  return issues.length > 0 && issues.every(
    issue => issue.status === 'approved' || issue.status === 'declined' || issue.status === 'repaired' || issue.status === 'resolved'
  );
};
```

**Check if all approved issues are repaired:**
```typescript
export const checkAllApprovedRepaired = (issues: InspectionIssue[]): boolean => {
  const approvedIssues = issues.filter(i => i.status === 'approved' || i.status === 'repaired');
  return approvedIssues.length > 0 && approvedIssues.every(issue => issue.status === 'repaired');
};
```

---

### 3. UI Updates (`src/pages/BicycleInspections.tsx`)

#### A. Add New Tabs

Update tabs from 3 to 5:

| Tab | Status | Description |
|-----|--------|-------------|
| Awaiting | `pending` | Bikes waiting to be inspected |
| No Issues | `inspected` | Inspected with no problems found (renamed) |
| Issues | `issues_found` | Issues reported, awaiting customer response |
| In Repair | `in_repair` | Customer responded, repairs in progress |
| Repaired | `repaired` | All approved repairs completed |

#### B. Rename "Mark Inspected" Button

**Current:**
```typescript
Mark Inspected
```

**Updated:**
```typescript
Mark Inspected (No Issues)
```

#### C. Add Filter for Each Status

```typescript
const awaitingInspection = inspections.filter((i: any) => !i.inspection || i.inspection.status === "pending");
const noIssues = inspections.filter((i: any) => i.inspection?.status === "inspected");
const withIssues = inspections.filter((i: any) => i.inspection?.status === "issues_found");
const inRepair = inspections.filter((i: any) => i.inspection?.status === "in_repair");
const repaired = inspections.filter((i: any) => i.inspection?.status === "repaired");
```

#### D. Auto-Move to "In Repair" When Customer Finishes Responding

After a customer accepts or declines an issue, check if all issues are resolved. If yes, automatically move the inspection to `in_repair`:

```typescript
const acceptIssueMutation = useMutation({
  mutationFn: async (issueId: string) => {
    const result = await acceptIssue(issueId);
    // After accepting, check if all issues are now resolved
    // and move to in_repair if needed
    return result;
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
    // Check and auto-transition handled in service layer
    toast.success("Issue accepted");
  },
});
```

Better approach: Add logic in the service layer to check after each accept/decline if all issues are resolved, then update inspection status.

#### E. "In Repair" Tab Admin Actions

For bikes in the "In Repair" tab, show:
- List of approved issues with "Mark as Repaired" button for each
- Once all approved issues are marked repaired, show "Complete Repairs" button to move to "Repaired" status

```typescript
{/* Admin actions for In Repair status */}
{isAdmin && inspection?.status === "in_repair" && (
  <div className="space-y-3">
    {/* Show approved issues with repair button */}
    {approvedIssues.map((issue) => (
      <div key={issue.id} className="flex items-center justify-between">
        <span>{issue.issue_description}</span>
        {issue.status === "approved" && (
          <Button size="sm" onClick={() => markRepairedMutation.mutate(issue.id)}>
            <Wrench className="h-4 w-4 mr-1" />
            Mark Repaired
          </Button>
        )}
        {issue.status === "repaired" && (
          <Badge variant="success">Repaired</Badge>
        )}
      </div>
    ))}
    
    {/* Complete button when all approved are repaired */}
    {allApprovedRepaired && (
      <Button onClick={() => completeRepairsMutation.mutate(inspection.id)}>
        <CheckCircle className="h-4 w-4 mr-1" />
        Complete Repairs
      </Button>
    )}
  </div>
)}
```

#### F. Badge Status Updates

Update badge rendering to include new statuses:

| Status | Badge Color | Label |
|--------|-------------|-------|
| pending | secondary | Awaiting Inspection |
| inspected | success | Inspected (No Issues) |
| issues_found | destructive | Issues Found |
| in_repair | warning (amber) | In Repair |
| repaired | success | Repaired |

---

### 4. Database Migration

Add new enum values to the database for `inspection_status` and `issue_status`:

```sql
-- Add new inspection statuses
ALTER TYPE inspection_status ADD VALUE IF NOT EXISTS 'in_repair';
ALTER TYPE inspection_status ADD VALUE IF NOT EXISTS 'repaired';

-- Add new issue status
ALTER TYPE issue_status ADD VALUE IF NOT EXISTS 'repaired';
```

---

## Summary of Changes

| File | Changes |
|------|---------|
| `src/types/inspection.ts` | Add `in_repair`, `repaired` to InspectionStatus; add `repaired` to IssueStatus |
| `src/services/inspectionService.ts` | Add `moveToInRepair`, `markIssueRepaired`, `moveToRepaired`, helper functions |
| `src/pages/BicycleInspections.tsx` | Add 2 new tabs, rename labels, add repair workflow mutations and UI |
| Database migration | Add new enum values |

---

## User Experience Flow

### Admin Workflow:
1. See bike in "Awaiting" tab
2. Click "Mark Inspected (No Issues)" OR "Report Issue"
3. If issues reported, bike moves to "Issues" tab
4. Customer responds (accept/decline each issue)
5. Once all issues responded, bike auto-moves to "In Repair" tab
6. Admin marks each approved issue as "Repaired"
7. Once all approved issues repaired, admin clicks "Complete Repairs"
8. Bike moves to "Repaired" tab

### Customer Workflow:
1. See bike in "Issues" tab with pending issues
2. Click "Accept" or "Decline" for each issue
3. Once all issues responded, bike moves to "In Repair" (visible status change)
4. Customer can view progress as issues are marked repaired
5. Final status shows "Repaired" when complete

