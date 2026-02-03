

# Add "Inspect and Service" Feature with Normalized Database Design

## Overview

This plan implements bicycle inspection tracking using properly normalized database tables, following the same pattern as `order_comments`. This approach:

- Keeps the `orders` table clean with just a single `needs_inspection` flag
- Creates a dedicated `bicycle_inspections` table for inspection records
- Creates an `inspection_issues` table for attention requests (allowing multiple issues per inspection)
- Provides a complete audit trail of who inspected what and when
- Allows multiple attention items per inspection if needed

---

## Database Schema

### Table 1: Add flag to orders table

```sql
ALTER TABLE public.orders
ADD COLUMN needs_inspection boolean DEFAULT false;
```

This is the only change to the orders table - a simple flag to indicate inspection is required.

### Table 2: bicycle_inspections (tracks the inspection event)

```sql
CREATE TABLE public.bicycle_inspections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'inspected', 'issues_found'
  inspected_at TIMESTAMP WITH TIME ZONE,
  inspected_by_id UUID REFERENCES public.profiles(id),
  inspected_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_bicycle_inspections_order_id ON public.bicycle_inspections(order_id);
CREATE INDEX idx_bicycle_inspections_status ON public.bicycle_inspections(status);

-- Enable RLS
ALTER TABLE public.bicycle_inspections ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage all inspections"
ON public.bicycle_inspections FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view inspections for their orders"
ON public.bicycle_inspections FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.orders 
  WHERE orders.id = bicycle_inspections.order_id 
  AND orders.user_id = auth.uid()
));
```

### Table 3: inspection_issues (tracks attention requests)

```sql
CREATE TABLE public.inspection_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID NOT NULL REFERENCES public.bicycle_inspections(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  issue_description TEXT NOT NULL,
  estimated_cost NUMERIC(10, 2),
  requested_by_id UUID NOT NULL REFERENCES public.profiles(id),
  requested_by_name TEXT NOT NULL,
  customer_response TEXT,
  customer_responded_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'declined', 'resolved'
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by_id UUID REFERENCES public.profiles(id),
  resolved_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_inspection_issues_inspection_id ON public.inspection_issues(inspection_id);
CREATE INDEX idx_inspection_issues_order_id ON public.inspection_issues(order_id);
CREATE INDEX idx_inspection_issues_status ON public.inspection_issues(status);

-- Enable RLS
ALTER TABLE public.inspection_issues ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage all issues"
ON public.inspection_issues FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view issues for their orders"
ON public.inspection_issues FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.orders 
  WHERE orders.id = inspection_issues.order_id 
  AND orders.user_id = auth.uid()
));

CREATE POLICY "Users can respond to issues for their orders"
ON public.inspection_issues FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.orders 
  WHERE orders.id = inspection_issues.order_id 
  AND orders.user_id = auth.uid()
));
```

---

## Entity Relationship

```text
orders
  ├── needs_inspection (boolean)
  │
  └──< bicycle_inspections (one-to-one or one-to-many)
         ├── id
         ├── order_id (FK)
         ├── status ('pending' | 'inspected' | 'issues_found')
         ├── inspected_at
         ├── inspected_by_id
         ├── inspected_by_name
         ├── notes
         │
         └──< inspection_issues (one-to-many)
                ├── id
                ├── inspection_id (FK)
                ├── order_id (FK) -- denormalized for easier querying
                ├── issue_description
                ├── estimated_cost
                ├── requested_by_id/name
                ├── customer_response
                ├── customer_responded_at
                ├── status ('pending' | 'approved' | 'declined' | 'resolved')
                └── resolved_at/by
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/types/order.ts` | Modify | Add `needsInspection` to Order type |
| `src/types/inspection.ts` | **Create** | New types for inspections and issues |
| `src/components/create-order/OrderOptions.tsx` | Modify | Add "Inspect and Service" toggle |
| `src/pages/CreateOrder.tsx` | Modify | Add `needsInspection` to schema |
| `src/services/orderService.ts` | Modify | Include `needs_inspection` when creating orders |
| `src/services/orderServiceUtils.ts` | Modify | Map `needs_inspection` field |
| `src/services/inspectionService.ts` | **Create** | Service for inspection CRUD operations |
| `src/pages/BicycleInspections.tsx` | **Create** | Main inspections page |
| `src/components/inspections/InspectionCard.tsx` | **Create** | Card component for each inspection |
| `src/components/inspections/IssueDialog.tsx` | **Create** | Dialog for adding issues |
| `src/components/inspections/CustomerResponseForm.tsx` | **Create** | Form for customer responses |
| `src/pages/JobScheduling.tsx` | Modify | Add `needs_inspection` to OrderData |
| `src/components/scheduling/RouteBuilder.tsx` | Modify | Add inspection status badge |
| `src/App.tsx` | Modify | Add route for `/bicycle-inspections` |
| `src/components/Layout.tsx` | Modify | Add navigation links |

---

## Implementation Details

### 1. New Types File (`src/types/inspection.ts`)

```typescript
export type InspectionStatus = 'pending' | 'inspected' | 'issues_found';
export type IssueStatus = 'pending' | 'approved' | 'declined' | 'resolved';

export interface BicycleInspection {
  id: string;
  order_id: string;
  status: InspectionStatus;
  inspected_at: string | null;
  inspected_by_id: string | null;
  inspected_by_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  issues?: InspectionIssue[];
}

export interface InspectionIssue {
  id: string;
  inspection_id: string;
  order_id: string;
  issue_description: string;
  estimated_cost: number | null;
  requested_by_id: string;
  requested_by_name: string;
  customer_response: string | null;
  customer_responded_at: string | null;
  status: IssueStatus;
  resolved_at: string | null;
  resolved_by_id: string | null;
  resolved_by_name: string | null;
  created_at: string;
  updated_at: string;
}
```

### 2. Inspection Service (`src/services/inspectionService.ts`)

Key functions:
- `getInspectionsForOrder(orderId)` - Get inspection record for an order
- `getPendingInspections()` - Get all orders awaiting inspection (admin)
- `getMyInspections(userId)` - Get inspections for user's orders (customer)
- `markAsInspected(orderId, inspectorId, inspectorName, notes?)` - Mark bike as inspected
- `addInspectionIssue(inspectionId, orderId, description, cost, requestedBy)` - Add attention request
- `submitCustomerResponse(issueId, response)` - Customer responds to issue
- `resolveIssue(issueId, resolverId, resolverName)` - Admin marks issue resolved

### 3. OrderOptions Component - Add Toggle

Add after the Part Exchange section:

```typescript
<FormField
  control={control}
  name="needsInspection"
  render={({ field }) => (
    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
      <div className="space-y-0.5">
        <FormLabel className="text-base">
          Inspect and Service
        </FormLabel>
        <FormDescription>
          Toggle if this bike requires inspection and servicing before delivery.
        </FormDescription>
      </div>
      <FormControl>
        <Switch
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      </FormControl>
    </FormItem>
  )}
/>
```

### 4. RouteBuilder - Inspection Badge

Add helper function following the existing `getCollectionStatusBadge` pattern:

```typescript
const getInspectionStatusBadge = (
  needsInspection: boolean | null | undefined,
  inspectionStatus?: InspectionStatus | null,
  hasOpenIssues?: boolean
): { text: string; color: string; icon: JSX.Element } | null => {
  if (!needsInspection) return null;
  
  if (hasOpenIssues) {
    return {
      text: 'Needs Attention',
      color: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
      icon: <Wrench className="h-3 w-3" />
    };
  }
  
  if (inspectionStatus === 'inspected') {
    return {
      text: 'Inspected',
      color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
      icon: <Wrench className="h-3 w-3" />
    };
  }
  
  return {
    text: 'Awaiting Inspection',
    color: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
    icon: <Wrench className="h-3 w-3" />
  };
};
```

### 5. Bicycle Inspections Page

**Admin View:**
- Tabs: "Awaiting Inspection" | "Inspected" | "Issues Pending"
- Each card shows order details with action buttons
- "Mark as Inspected" creates inspection record with status 'inspected'
- "Report Issue" opens dialog to add issue with description + cost

**Customer View:**
- See only their orders with `needs_inspection = true`
- View inspection status and any issues
- Respond to issues with text response

**UI Layout:**

```text
┌─────────────────────────────────────────────────────────────────┐
│  Bicycle Inspections                                            │
├─────────────────────────────────────────────────────────────────┤
│  [Awaiting] [Inspected] [Issues Pending]                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  🚲 Trek Domane SL7                                       │ │
│  │  #TCC-ABC123 • John Smith → Jane Doe                      │ │
│  │  Status: Awaiting Inspection                              │ │
│  │                                                            │ │
│  │  [Mark Inspected] [Report Issue]      ← Admin only        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  ⚠️ Specialized Tarmac                                    │ │
│  │  #TCC-DEF456 • Inspected by: Admin on Jan 15              │ │
│  │                                                            │ │
│  │  ISSUE: Front brake pads worn                             │ │
│  │  Estimated Cost: £45.00                                   │ │
│  │  Status: Awaiting Customer Response                       │ │
│  │                                                            │ │
│  │  [Your Response:]                      ← Customer only    │ │
│  │  ┌─────────────────────────────────┐                      │ │
│  │  │ Please proceed with the repair  │                      │ │
│  │  └─────────────────────────────────┘                      │ │
│  │  [Submit Response]                                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6. Navigation

Add to Layout.tsx for both admin and customer nav:

**Admin (after "Loading & Storage"):**
```typescript
<Link to="/bicycle-inspections" ...>
  <Wrench className="mr-2 h-4 w-4" />
  Bicycle Inspections
</Link>
```

**Customers (B2B/B2C):**
```typescript
<Link to="/bicycle-inspections" ...>
  <Wrench className="mr-2 h-4 w-4" />
  My Inspections
</Link>
```

---

## Data Flow

```text
Order Creation:
────────────────────────────────────────────────────────
User toggles "Inspect and Service" on Create Order
    ↓
orders.needs_inspection = true
    ↓
Job Scheduling shows "Awaiting Inspection" badge
    ↓
Bike collected → appears on Bicycle Inspections page

Admin Inspection - No Issues:
────────────────────────────────────────────────────────
Admin clicks "Mark as Inspected"
    ↓
INSERT into bicycle_inspections (status: 'inspected', inspected_at: now())
    ↓
Job card badge → "Inspected" (green)

Admin Inspection - Issues Found:
────────────────────────────────────────────────────────
Admin clicks "Report Issue"
    ↓
INSERT into bicycle_inspections (status: 'issues_found')
INSERT into inspection_issues (issue_description, estimated_cost)
    ↓
Job card badge → "Needs Attention" (red)
Customer sees issue on their inspections page

Customer Response:
────────────────────────────────────────────────────────
Customer views issue, types response
    ↓
UPDATE inspection_issues SET customer_response, customer_responded_at
    ↓
Admin sees response, can resolve issue
```

---

## Role-Based Access Summary

| Feature | Admin | Customer (Owner) | Others |
|---------|-------|------------------|--------|
| View all inspections | Yes | No | No |
| View own order inspections | Yes | Yes | No |
| Mark as Inspected | Yes | No | No |
| Report Issues | Yes | No | No |
| Respond to Issues | No | Yes | No |
| Resolve Issues | Yes | No | No |
| See inspection badge on Job Scheduling | Yes | N/A | N/A |

---

## Benefits of This Design

1. **Clean orders table** - Only a simple `needs_inspection` boolean added
2. **Full audit trail** - Who inspected, when, what issues were found
3. **Multiple issues per inspection** - Can report several problems
4. **Issue workflow** - Track from reported → customer response → resolved
5. **Follows existing patterns** - Same structure as `order_comments`
6. **Scalable** - Easy to add more fields or statuses later
7. **Proper RLS** - Admins manage, customers view/respond to their own

---

## Summary

| Task | Description |
|------|-------------|
| Database migration | Add `needs_inspection` to orders, create 2 new tables |
| New types file | TypeScript interfaces for inspections and issues |
| Form option | Add "Inspect and Service" toggle to Order Options |
| Inspection service | CRUD operations for inspections and issues |
| Job card badge | "Awaiting Inspection", "Inspected", or "Needs Attention" |
| New page | Bicycle Inspections with role-based views |
| Issue workflow | Admin reports → Customer responds → Admin resolves |
| Navigation | Links for admins and customers |

