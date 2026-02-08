

## Save & Load Routes Feature

Add the ability to save the current route from the timeslot popup with a user-defined name and auto-generated GUID, and provide a way to load previously saved routes.

---

## Database Schema

### New Table: `saved_routes`

```sql
CREATE TABLE saved_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  job_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_time TEXT DEFAULT '09:00',
  starting_bikes INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE saved_routes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage all saved routes"
  ON saved_routes FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view their own saved routes"
  ON saved_routes FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create saved routes"
  ON saved_routes FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own saved routes"
  ON saved_routes FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own saved routes"
  ON saved_routes FOR DELETE
  USING (auth.uid() = created_by);
```

---

## New Components

### 1. `src/components/scheduling/SaveRouteDialog.tsx`

Dialog for saving the current route:
- Input field for route name
- Shows auto-generated GUID (with copy button)
- Summary of jobs in route (X collections, Y deliveries)
- Save button triggers insert to `saved_routes` table

```typescript
interface SaveRouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: SelectedJob[];
  startTime: string;
  startingBikes: number;
  onSaved: (routeId: string, routeName: string) => void;
}
```

### 2. `src/components/scheduling/LoadRouteDialog.tsx`

Dialog for loading saved routes:
- Fetches all saved routes from database
- Shows list with route name, job count, creation date
- Search/filter by name
- "Load" button per route
- "Delete" button with confirmation
- Sorted by most recent first

```typescript
interface LoadRouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: OrderData[];
  onLoadRoute: (jobs: SelectedJob[], startTime: string, startingBikes: number) => void;
}
```

---

## RouteBuilder Changes

### New State Variables
```typescript
const [showSaveRouteDialog, setShowSaveRouteDialog] = useState(false);
const [showLoadRouteDialog, setShowLoadRouteDialog] = useState(false);
```

### New Imports
```typescript
import { Save, FolderOpen } from "lucide-react";
import SaveRouteDialog from './SaveRouteDialog';
import LoadRouteDialog from './LoadRouteDialog';
```

### Handle Route Load
```typescript
const handleLoadSavedRoute = (
  jobs: SelectedJob[], 
  startTime: string, 
  startingBikes: number
) => {
  setSelectedJobs(jobs);
  setStartTime(startTime);
  setStartingBikes(startingBikes);
  setShowLoadRouteDialog(false);
  toast.success('Route loaded successfully');
};
```

---

## UI Changes

### Desktop Timeslot Dialog (line 2628)

Add Save and Load buttons next to Send All:

```text
[Save Route]  [Load Route]  [Send All Timeslots]
```

### Mobile Timeslot Drawer (line 2525)

Add buttons above Send All:

```text
[Save Route]    [Load Route]
       [Send All Timeslots]
```

### Button Styling

```typescript
<Button
  onClick={() => setShowSaveRouteDialog(true)}
  variant="outline"
  size="sm"
  className="flex items-center gap-1"
>
  <Save className="h-3 w-3" />
  Save Route
</Button>

<Button
  onClick={() => setShowLoadRouteDialog(true)}
  variant="outline"
  size="sm"
  className="flex items-center gap-1"
>
  <FolderOpen className="h-3 w-3" />
  Load Route
</Button>
```

---

## Files to Create

| File | Description |
|------|-------------|
| `src/components/scheduling/SaveRouteDialog.tsx` | Dialog for entering route name and saving to database |
| `src/components/scheduling/LoadRouteDialog.tsx` | Dialog for browsing and loading saved routes |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/scheduling/RouteBuilder.tsx` | Add state, imports, handlers, buttons, and dialog components |
| `src/integrations/supabase/types.ts` | Will auto-update with `saved_routes` table types |

---

## SaveRouteDialog Flow

1. User clicks "Save Route"
2. Dialog opens showing:
   - Route name input field
   - Auto-generated GUID (read-only with copy button)
   - Job summary (e.g., "8 jobs: 3 collections, 5 deliveries")
3. User enters name and clicks "Save Route"
4. Job data is serialized (orderId, type, address, contactName, phoneNumber, lat, lon, breakDuration, breakType)
5. Insert to `saved_routes` table with user's ID
6. Success toast with truncated route ID

---

## LoadRouteDialog Flow

1. User clicks "Load Route"
2. Dialog fetches saved routes from database
3. Shows list sorted by created_at DESC:
   - Route name
   - Job count badge
   - Created date
   - Load button
   - Delete button
4. User clicks "Load" on desired route
5. Job data is deserialized and matched to current orders
6. `selectedJobs`, `startTime`, `startingBikes` are updated
7. Dialog closes with success toast

---

## Job Data Serialization

When saving, strip out `orderData` (large) and keep essential fields:

```typescript
const jobData = jobs.map(job => ({
  orderId: job.orderId,
  type: job.type,
  address: job.address,
  contactName: job.contactName,
  phoneNumber: job.phoneNumber,
  lat: job.lat,
  lon: job.lon,
  breakDuration: job.breakDuration,
  breakType: job.breakType,
  order: job.order
}));
```

When loading, re-hydrate `orderData` from current orders list:

```typescript
const loadedJobs = savedJobData.map(savedJob => {
  const order = orders.find(o => o.id === savedJob.orderId);
  return {
    ...savedJob,
    orderData: order || undefined
  };
});
```

---

## UI Previews

**Save Route Dialog:**
```text
+------------------------------------------+
|  Save Route                         [X]  |
+------------------------------------------+
|                                          |
|  Route Name                              |
|  [Birmingham North AM Run           ]    |
|                                          |
|  Route ID                                |
|  [a1b2c3d4-e5f6-7890-...] [Copy]         |
|  Auto-generated unique identifier        |
|                                          |
|  This route contains 8 jobs              |
|  (3 collections, 5 deliveries)           |
|                                          |
|              [Cancel]  [Save Route]      |
+------------------------------------------+
```

**Load Route Dialog:**
```text
+------------------------------------------+
|  Load Saved Route                   [X]  |
+------------------------------------------+
|  [Search routes...               ]       |
|                                          |
|  +------------------------------------+  |
|  | Birmingham North AM Run           |  |
|  | 8 jobs  |  Created Feb 8, 2026    |  |
|  |                    [Load] [Delete]|  |
|  +------------------------------------+  |
|                                          |
|  +------------------------------------+  |
|  | London South Route                |  |
|  | 12 jobs  |  Created Feb 7, 2026   |  |
|  |                    [Load] [Delete]|  |
|  +------------------------------------+  |
|                                          |
|                             [Close]      |
+------------------------------------------+
```

---

## Technical Details

### Delete Confirmation
When deleting, show an alert dialog confirming the action before removing from database.

### Loading Stale Routes
If a saved route references orders that no longer exist or have been scheduled, those jobs will have `orderData: undefined`. The UI should gracefully handle this (possibly show a warning badge).

### Permissions
- Admins can see and manage all saved routes
- Regular users can only see their own saved routes

