

# Multi-Issue Report Dialog with Accept/Reject Actions

## Overview

This plan enhances the "Report Issue" dialog to allow admins to add multiple issues at once. Each issue will have its own description and estimated cost field. Issues are then inserted individually into the database, and customers can accept or reject each issue separately.

---

## Current State

The existing dialog has:
- Single issue description textarea
- Single estimated cost input
- One "Report Issue" button that submits a single issue

---

## Proposed Changes

### 1. Enhanced Dialog State Management

Replace single issue fields with an array-based approach:

**Current state:**
```typescript
const [issueDescription, setIssueDescription] = useState("");
const [estimatedCost, setEstimatedCost] = useState("");
```

**New state:**
```typescript
interface IssueEntry {
  description: string;
  estimatedCost: string;
}

const [issueCount, setIssueCount] = useState(1);
const [issues, setIssues] = useState<IssueEntry[]>([{ description: "", estimatedCost: "" }]);
```

### 2. Updated Dialog UI

```text
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Report Issues                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Number of Issues: [1 ▼]                                        │
│                   (dropdown: 1, 2, 3, 4, 5)                     │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Issue #1                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ What's wrong with the bike?                                 ││
│  │ [Front brake pads worn                               ]      ││
│  └─────────────────────────────────────────────────────────────┘│
│  Estimated Repair Cost (£)                                      │
│  [45.00                                                 ]       │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Issue #2                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Chain needs replacing                                       ││
│  └─────────────────────────────────────────────────────────────┘│
│  Estimated Repair Cost (£)                                      │
│  [35.00                                                 ]       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                               [Cancel]  [Report 2 Issues]       │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Mutation Update for Batch Issues

Create a new mutation that loops through all issues and inserts them individually:

```typescript
const addMultipleIssuesMutation = useMutation({
  mutationFn: async ({ orderId, issues }: { orderId: string; issues: IssueEntry[] }) => {
    if (!user?.id || !userProfile?.name) {
      throw new Error("User not authenticated");
    }
    
    // Insert each issue individually
    const results = [];
    for (const issue of issues) {
      if (issue.description.trim()) {
        const cost = issue.estimatedCost ? parseFloat(issue.estimatedCost) : null;
        const result = await addInspectionIssue(
          orderId,
          issue.description,
          cost,
          user.id,
          userProfile.name || user.email || "Admin"
        );
        results.push(result);
      }
    }
    return results;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
    setIssueDialogOpen(false);
    resetIssueForm();
    toast.success("Issues reported successfully");
  },
  onError: (error) => {
    toast.error("Failed to report issues");
    console.error(error);
  },
});
```

### 4. Customer Accept/Reject Actions

Add new service functions and UI for customers to accept or reject issues:

**New service functions in `inspectionService.ts`:**

```typescript
// Accept issue (customer approves the repair)
export const acceptIssue = async (issueId: string): Promise<InspectionIssue | null> => {
  const { data, error } = await supabase
    .from('inspection_issues')
    .update({
      status: 'approved' as IssueStatus,
      customer_response: 'Approved',
      customer_responded_at: new Date().toISOString(),
    })
    .eq('id', issueId)
    .select()
    .single();
  // ...
};

// Decline issue (customer rejects the repair)
export const declineIssue = async (
  issueId: string,
  reason?: string
): Promise<InspectionIssue | null> => {
  const { data, error } = await supabase
    .from('inspection_issues')
    .update({
      status: 'declined' as IssueStatus,
      customer_response: reason || 'Declined',
      customer_responded_at: new Date().toISOString(),
    })
    .eq('id', issueId)
    .select()
    .single();
  // ...
};
```

**Updated Customer UI for issues:**

Replace the free-text response with Accept/Decline buttons:

```text
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Front brake pads worn                                       │
│  Estimated Cost: £45.00                                         │
│  Reported by Admin                                              │
│                                                     [pending]   │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐                              │
│  │ ✓ Accept    │  │ ✗ Decline   │                              │
│  └─────────────┘  └─────────────┘                              │
│                                                                 │
│  [Optional: Add notes...]                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/BicycleInspections.tsx` | Add issue count selector, dynamic issue fields, accept/decline mutations |
| `src/services/inspectionService.ts` | Add `acceptIssue` and `declineIssue` functions |

---

## Implementation Details

### Dialog State Updates

```typescript
// New state variables
const [issueCount, setIssueCount] = useState(1);
const [issues, setIssues] = useState<Array<{ description: string; estimatedCost: string }>>([
  { description: "", estimatedCost: "" }
]);

// Update issues array when count changes
const handleIssueCountChange = (count: string) => {
  const newCount = parseInt(count);
  setIssueCount(newCount);
  
  // Resize the issues array
  setIssues(prev => {
    if (newCount > prev.length) {
      // Add empty entries
      return [...prev, ...Array(newCount - prev.length).fill({ description: "", estimatedCost: "" })];
    } else {
      // Trim excess entries
      return prev.slice(0, newCount);
    }
  });
};

// Update individual issue fields
const updateIssue = (index: number, field: 'description' | 'estimatedCost', value: string) => {
  setIssues(prev => prev.map((issue, i) => 
    i === index ? { ...issue, [field]: value } : issue
  ));
};

// Reset form when dialog closes
const resetIssueForm = () => {
  setIssueCount(1);
  setIssues([{ description: "", estimatedCost: "" }]);
  setSelectedOrderId(null);
};
```

### Customer Accept/Decline UI

```typescript
{/* Customer Actions - Accept/Decline */}
{!isAdmin && isOwner && issue.status === "pending" && (
  <div className="mt-3 space-y-2">
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="default"
        className="bg-green-600 hover:bg-green-700"
        onClick={() => acceptIssueMutation.mutate(issue.id)}
        disabled={acceptIssueMutation.isPending}
      >
        {acceptIssueMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <CheckCircle className="h-4 w-4 mr-1" />
        )}
        Accept
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => declineIssueMutation.mutate({ 
          issueId: issue.id, 
          reason: customerResponses[issue.id] 
        })}
        disabled={declineIssueMutation.isPending}
      >
        {declineIssueMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <X className="h-4 w-4 mr-1" />
        )}
        Decline
      </Button>
    </div>
    <Input
      placeholder="Optional: Add notes..."
      value={customerResponses[issue.id] || ""}
      onChange={(e) =>
        setCustomerResponses((prev) => ({
          ...prev,
          [issue.id]: e.target.value,
        }))
      }
      className="text-sm"
    />
  </div>
)}
```

### Badge Colors by Status

| Status | Badge Color | Meaning |
|--------|-------------|---------|
| pending | warning (amber) | Awaiting customer response |
| approved | success (green) | Customer approved the repair |
| declined | destructive (red) | Customer declined the repair |
| resolved | success (green) | Admin marked as completed |

---

## Data Flow

```text
Admin Reports Multiple Issues:
────────────────────────────────────────────────────────
Admin opens "Report Issue" dialog
    ↓
Selects "3" from issue count dropdown
    ↓
3 issue forms appear with description + cost fields
    ↓
Fills in all 3 issues
    ↓
Clicks "Report 3 Issues"
    ↓
Each issue is inserted individually into inspection_issues table
    ↓
Customer sees 3 separate issues to respond to

Customer Response:
────────────────────────────────────────────────────────
Customer views their inspection
    ↓
Sees 3 pending issues, each with Accept/Decline buttons
    ↓
Clicks "Accept" on Issue #1 → status: 'approved'
Clicks "Decline" on Issue #2 (with notes) → status: 'declined'
Clicks "Accept" on Issue #3 → status: 'approved'
    ↓
Admin sees responses and can proceed accordingly
```

---

## Summary

| Task | Description |
|------|-------------|
| Issue count selector | Dropdown to select 1-5 issues to add |
| Dynamic issue fields | Generate description + cost fields based on count |
| Batch submission | Submit all issues individually to the database |
| Accept/Decline buttons | Replace free-text response for customers |
| New service functions | `acceptIssue` and `declineIssue` in inspectionService |
| Status badges | Color-coded by pending/approved/declined/resolved |

