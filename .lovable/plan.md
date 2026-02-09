

# Add Delete Button to Driver Timeslips

## Overview

Add a delete button to the TimeslipCard component that allows admins to delete timeslips. The deletion will require confirmation to prevent accidental deletions.

## Changes Required

### 1. Update TimeslipCard Component

**File: `src/components/timeslips/TimeslipCard.tsx`**

- Add `Trash2` icon import from lucide-react
- Add `onDelete` callback prop to the interface
- Add a delete button in the admin actions section with a trash icon
- The button will use the `destructive` variant (red styling)

### 2. Update DriverTimeslips Page

**File: `src/pages/DriverTimeslips.tsx`**

- Import `AlertDialog` components for delete confirmation
- Add state for tracking which timeslip is pending deletion
- Add a delete mutation using `timeslipService.deleteTimeslip`
- Add a confirmation dialog that shows before deletion
- Pass the `onDelete` handler to each `TimeslipCard`

## Implementation Details

### TimeslipCard Changes

```text
Add to interface:
- onDelete?: (id: string) => void

Add to admin actions section:
- Delete button with Trash2 icon
- Uses destructive variant
- Positioned after existing action buttons
```

### DriverTimeslips Changes

```text
New state:
- deletingTimeslipId: string | null

New mutation:
- deleteMutation using timeslipService.deleteTimeslip
- Shows success/error toast
- Invalidates timeslips query cache

New handler:
- handleDelete(id: string) - opens confirmation dialog

Confirmation dialog:
- Shows warning about permanent deletion
- Displays driver name and date for the timeslip
- Cancel and Delete buttons
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/timeslips/TimeslipCard.tsx` | Add Trash2 icon, onDelete prop, delete button |
| `src/pages/DriverTimeslips.tsx` | Add delete mutation, confirmation dialog, pass onDelete to cards |

## User Experience

- Delete button appears in the admin actions row alongside Edit, Approve, and Reject buttons
- Clicking Delete opens a confirmation dialog
- User must confirm before the timeslip is permanently deleted
- Success/error feedback via toast notifications

