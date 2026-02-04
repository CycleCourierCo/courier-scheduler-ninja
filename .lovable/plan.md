

# Add Inspection Checklist Dialog for "Mark Inspected (No Issues)"

## Overview

Add a confirmation popup dialog when marking a bicycle inspection as "inspected (no issues)". The dialog will require the user to check off each standard inspection item and optionally add comments before completing the inspection.

---

## Current Flow

| Step | Current Behavior |
|------|-----------------|
| Admin clicks "Mark Inspected (No Issues)" | Immediately marks as inspected |
| No checklist | No verification of work done |
| No notes required | Notes are optional and not prompted |

---

## New Flow

| Step | New Behavior |
|------|--------------|
| Admin clicks "Mark Inspected (No Issues)" | Opens checklist dialog |
| Checklist presented | 4 inspection items must be checked |
| Comments optional | Each item can have optional notes |
| Confirm button | Only enabled when all items checked |
| On confirm | Saves notes and marks as inspected |

---

## Inspection Items

| Item | Description |
|------|-------------|
| Brake and gear tuning | Brakes and gears adjusted and functioning |
| Full safety inspection | Frame, wheels, drivetrain, tyres checked |
| Tyre pressure check and adjustment | Tyres inflated to correct pressure |
| Light cleaning and bolt tightening | Bike cleaned and bolts secured |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/BicycleInspections.tsx` | Add inspection checklist dialog with checkboxes and comments |
| `src/services/inspectionService.ts` | Update `markAsInspected` to store checklist data in notes |

---

## Implementation Details

### 1. Add State for Checklist Dialog (`src/pages/BicycleInspections.tsx`)

```typescript
// Define inspection items
const INSPECTION_ITEMS = [
  { id: 'brakes_gears', label: 'Brake and gear tuning' },
  { id: 'safety_inspection', label: 'Full safety inspection (frame, wheels, drivetrain, tyres)' },
  { id: 'tyre_pressure', label: 'Tyre pressure check and adjustment' },
  { id: 'cleaning_bolts', label: 'Light cleaning and bolt tightening' },
];

// Add state
const [inspectionChecklistOpen, setInspectionChecklistOpen] = useState(false);
const [selectedOrderForInspection, setSelectedOrderForInspection] = useState<string | null>(null);
const [inspectionChecklist, setInspectionChecklist] = useState<Record<string, boolean>>({});
const [inspectionComments, setInspectionComments] = useState<Record<string, string>>({});
```

### 2. Add Handler Functions

```typescript
const handleOpenInspectionChecklist = (orderId: string) => {
  setSelectedOrderForInspection(orderId);
  setInspectionChecklist({});
  setInspectionComments({});
  setInspectionChecklistOpen(true);
};

const handleChecklistItemToggle = (itemId: string) => {
  setInspectionChecklist(prev => ({
    ...prev,
    [itemId]: !prev[itemId]
  }));
};

const handleChecklistCommentChange = (itemId: string, comment: string) => {
  setInspectionComments(prev => ({
    ...prev,
    [itemId]: comment
  }));
};

const allItemsChecked = INSPECTION_ITEMS.every(
  item => inspectionChecklist[item.id]
);

const handleConfirmInspection = () => {
  if (!selectedOrderForInspection || !allItemsChecked) return;
  
  // Format notes with checklist and comments
  const notes = INSPECTION_ITEMS.map(item => {
    const comment = inspectionComments[item.id];
    return comment 
      ? `✓ ${item.label}: ${comment}`
      : `✓ ${item.label}`;
  }).join('\n');
  
  markInspectedMutation.mutate({ orderId: selectedOrderForInspection, notes });
  setInspectionChecklistOpen(false);
};
```

### 3. Update Mutation

```typescript
const markInspectedMutation = useMutation({
  mutationFn: async ({ orderId, notes }: { orderId: string; notes?: string }) => {
    if (!user?.id || !userProfile?.name) {
      throw new Error("User not authenticated");
    }
    return markAsInspected(orderId, user.id, userProfile.name || user.email || "Admin", notes);
  },
  // ... rest unchanged
});
```

### 4. Update Button to Open Dialog

```typescript
<Button
  size="sm"
  onClick={() => handleOpenInspectionChecklist(order.id)}
  disabled={markInspectedMutation.isPending}
>
  <CheckCircle className="h-4 w-4 mr-1" />
  Mark Inspected (No Issues)
</Button>
```

### 5. Add Checklist Dialog

```typescript
<Dialog open={inspectionChecklistOpen} onOpenChange={setInspectionChecklistOpen}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-green-500" />
        Inspection Checklist
      </DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-4">
      <p className="text-sm text-muted-foreground">
        Please confirm all inspection tasks have been completed:
      </p>
      {INSPECTION_ITEMS.map((item) => (
        <div key={item.id} className="space-y-2 p-3 border rounded-lg">
          <div className="flex items-start gap-3">
            <Checkbox
              id={item.id}
              checked={inspectionChecklist[item.id] || false}
              onCheckedChange={() => handleChecklistItemToggle(item.id)}
            />
            <Label htmlFor={item.id} className="text-sm font-medium cursor-pointer">
              {item.label}
            </Label>
          </div>
          {inspectionChecklist[item.id] && (
            <Input
              placeholder="Optional: Add notes..."
              value={inspectionComments[item.id] || ""}
              onChange={(e) => handleChecklistCommentChange(item.id, e.target.value)}
              className="mt-2 text-sm"
            />
          )}
        </div>
      ))}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setInspectionChecklistOpen(false)}>
        Cancel
      </Button>
      <Button 
        onClick={handleConfirmInspection}
        disabled={!allItemsChecked || markInspectedMutation.isPending}
      >
        {markInspectedMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <CheckCircle className="h-4 w-4 mr-1" />
        )}
        Confirm Inspection Complete
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## User Experience

```
┌──────────────────────────────────────────┐
│ ✓ Inspection Checklist                   │
├──────────────────────────────────────────┤
│ Please confirm all inspection tasks      │
│ have been completed:                     │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ ☑ Brake and gear tuning              │ │
│ │ [Optional: Add notes...            ] │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ ☑ Full safety inspection (frame,    │ │
│ │   wheels, drivetrain, tyres)         │ │
│ │ [Replaced worn brake pads          ] │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ ☑ Tyre pressure check and adjustment│ │
│ │ [Optional: Add notes...            ] │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ ☑ Light cleaning and bolt tightening│ │
│ │ [Optional: Add notes...            ] │ │
│ └──────────────────────────────────────┘ │
│                                          │
│              [Cancel] [Confirm ✓]        │
└──────────────────────────────────────────┘
```

---

## Notes Storage

The notes will be stored as a formatted string in the `bicycle_inspections.notes` field:

```
✓ Brake and gear tuning
✓ Full safety inspection (frame, wheels, drivetrain, tyres): Replaced worn brake pads
✓ Tyre pressure check and adjustment
✓ Light cleaning and bolt tightening
```

---

## Summary

| Task | Description |
|------|-------------|
| Add checklist state | Track checked items and comments |
| Add dialog component | Show checklist with checkboxes and optional comment fields |
| Update button | Open dialog instead of direct mutation |
| Update mutation | Accept notes parameter |
| Store checklist in notes | Format and save to inspection record |

