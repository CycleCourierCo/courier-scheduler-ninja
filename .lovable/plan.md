

# Add Tracking Number and Collection Status to RouteBuilder Job Cards

## Overview
Enhance the job cards in the **RouteBuilder** component on the Job Scheduling page to display:
1. **Tracking Number** - Show the order's tracking number on each job card
2. **Collection Status Badge** - For delivery jobs, show whether the bike has been collected using the `order_collected` database field

## Current State
- The RouteBuilder shows job cards in a grid (lines 1856-1912)
- Each card displays: job type badge, contact name, address, and bike brand/model
- The `OrderData` interface has `tracking_number` but not `order_collected`
- The database query in `JobScheduling.tsx` uses `select('*')` so all fields are available

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/JobScheduling.tsx` | Add `order_collected` and `order_delivered` to the `OrderData` interface |
| `src/components/scheduling/RouteBuilder.tsx` | Add tracking number display and collection status badge to job cards |

## Implementation Details

### 1. JobScheduling.tsx - Update OrderData Interface

Add the `order_collected` field to the interface:

```typescript
export interface OrderData {
  id: string;
  status: OrderStatus;
  tracking_number: string;
  bike_brand: string | null;
  bike_model: string | null;
  bike_quantity: number | null;
  created_at: string;
  sender: ContactInfo & { address: Address };
  receiver: ContactInfo & { address: Address };
  scheduled_pickup_date: string | null;
  scheduled_delivery_date: string | null;
  pickup_date: string[] | null;
  delivery_date: string[] | null;
  collection_confirmation_sent_at: string | null;
  order_collected: boolean | null;  // NEW
  order_delivered: boolean | null;  // NEW
}
```

### 2. RouteBuilder.tsx - Update Job Cards (around lines 1868-1909)

Add the tracking number and collection status to each job card. The current card structure:

```tsx
<CardContent className="p-4">
  <div className="flex justify-between items-start mb-2">
    <Badge variant={job.type === 'pickup' ? 'default' : 'secondary'}>
      {job.type === 'pickup' ? 'Collection' : 'Delivery'}
    </Badge>
    {isSelected && (
      <Badge variant="outline" className="bg-primary text-primary-foreground">
        #{selectedOrder}
      </Badge>
    )}
  </div>
  
  <div className="space-y-2">
    <p className="font-medium text-sm">{job.contactName}</p>
    <div className="flex items-start gap-1">
      <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{job.address}</p>
    </div>
    <p className="text-xs text-muted-foreground">
      Order: {job.order.bike_brand} {job.order.bike_model}
    </p>
    ...
  </div>
</CardContent>
```

Updated structure with tracking number and collection status:

```tsx
<CardContent className="p-4">
  <div className="flex justify-between items-start mb-2">
    <div className="flex items-center gap-2">
      <Badge variant={job.type === 'pickup' ? 'default' : 'secondary'}>
        {job.type === 'pickup' ? 'Collection' : 'Delivery'}
      </Badge>
      {/* Collection Status Badge - only for delivery jobs */}
      {job.type === 'delivery' && (
        job.order.order_collected ? (
          <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            Collected
          </Badge>
        ) : (
          <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            Awaiting Collection
          </Badge>
        )
      )}
    </div>
    {isSelected && (
      <Badge variant="outline" className="bg-primary text-primary-foreground">
        #{selectedOrder}
      </Badge>
    )}
  </div>
  
  <div className="space-y-2">
    {/* Tracking Number */}
    <p className="font-medium text-sm flex items-center gap-1">
      <Package className="h-3 w-3 text-muted-foreground" />
      #{job.order.tracking_number}
    </p>
    <p className="text-sm">{job.contactName}</p>
    <div className="flex items-start gap-1">
      <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{job.address}</p>
    </div>
    <p className="text-xs text-muted-foreground">
      {job.order.bike_brand} {job.order.bike_model}
    </p>
    ...
  </div>
</CardContent>
```

Also add `Package` to the imports (already imported on line 12).

## Visual Result

**Collection Card:**
```
┌─────────────────────────────────────────┐
│ [Collection]                       [#3] │
├─────────────────────────────────────────┤
│ 📦 #CC-123456                           │
│ John Smith                              │
│ 📍 123 High Street, London SW1A 1AA     │
│ Trek Domane SL6                         │
└─────────────────────────────────────────┘
```

**Delivery Card (Collected):**
```
┌─────────────────────────────────────────┐
│ [Delivery] [Collected]             [#5] │
├─────────────────────────────────────────┤
│ 📦 #CC-123456                           │
│ Jane Doe                                │
│ 📍 456 Park Lane, Manchester M1 2AB     │
│ Specialized Tarmac                      │
└─────────────────────────────────────────┘
```

**Delivery Card (Not Collected):**
```
┌─────────────────────────────────────────┐
│ [Delivery] [Awaiting Collection]        │
├─────────────────────────────────────────┤
│ 📦 #CC-789012                           │
│ Bob Wilson                              │
│ 📍 789 Oak Road, Birmingham B1 1AA      │
│ Canyon Aeroad                           │
└─────────────────────────────────────────┘
```

## Summary

| Change | Purpose |
|--------|---------|
| Add `order_collected` to OrderData | Access collection status from database |
| Show tracking number with package icon | Quick order identification |
| Show "Collected" badge (green) on deliveries | Indicate bike is ready for delivery |
| Show "Awaiting Collection" badge (amber) on deliveries | Indicate bike still needs pickup |

