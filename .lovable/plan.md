
# Fix: Update order_collected and order_delivered Booleans

## Problem

The `order_collected` and `order_delivered` boolean fields on orders are **never updated** after the initial database migration. This causes:
- Route Builder showing "Awaiting Collection" even after collection is complete
- OptimoRoute sync potentially creating unnecessary pickup jobs

## Root Cause

The migration created these columns and populated them for existing orders, but the ongoing processes that mark orders as collected/delivered only update the timestamp fields, not the boolean fields.

| Event | Currently Updates | Should Also Update |
|-------|------------------|-------------------|
| Collection confirmation email sent | `collection_confirmation_sent_at` | `order_collected = true` |
| Delivery confirmation email sent | `delivery_confirmation_sent_at` | `order_delivered = true` |
| Status → "collected" via webhook | `status` | `order_collected = true` |
| Status → "delivered" via webhook | `status` | `order_delivered = true` |

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/send-email/index.ts` | Add `order_collected: true` and `order_delivered: true` to update statements |
| `supabase/functions/shipday-webhook/index.ts` | Add `order_collected: true` when status is "collected", `order_delivered: true` when status is "delivered" |

## Implementation Details

### 1. send-email/index.ts - Collection Confirmation (around line 497)

**Before:**
```typescript
await supabase
  .from("orders")
  .update({ collection_confirmation_sent_at: new Date().toISOString() })
  .eq("id", orderId);
```

**After:**
```typescript
await supabase
  .from("orders")
  .update({ 
    collection_confirmation_sent_at: new Date().toISOString(),
    order_collected: true  // Mark as collected
  })
  .eq("id", orderId);
```

### 2. send-email/index.ts - Delivery Confirmation (around line 331)

**Before:**
```typescript
await supabase
  .from("orders")
  .update({ delivery_confirmation_sent_at: new Date().toISOString() })
  .eq("id", orderId);
```

**After:**
```typescript
await supabase
  .from("orders")
  .update({ 
    delivery_confirmation_sent_at: new Date().toISOString(),
    order_delivered: true  // Mark as delivered
  })
  .eq("id", orderId);
```

### 3. shipday-webhook/index.ts - Status Update (around line 282)

**Before:**
```typescript
.update({
  status: newStatus,
  tracking_events: trackingEvents,
  updated_at: new Date().toISOString(),
})
```

**After:**
```typescript
// Build update object
const updateData: any = {
  status: newStatus,
  tracking_events: trackingEvents,
  updated_at: new Date().toISOString(),
};

// Set collection/delivery booleans based on status
if (newStatus === 'collected' || newStatus === 'driver_to_delivery' || newStatus === 'delivery_scheduled') {
  updateData.order_collected = true;
}
if (newStatus === 'delivered') {
  updateData.order_collected = true;  // Must be collected to be delivered
  updateData.order_delivered = true;
}

await supabase
  .from("orders")
  .update(updateData)
  .eq("id", dbOrder.id);
```

## Data Flow After Fix

```
Collection Confirmed:
─────────────────────
Shipday Webhook (status: "collected")
    ↓
Updates: status, tracking_events, order_collected = true
    ↓
send-email (collection_confirmation)
    ↓
Updates: collection_confirmation_sent_at, order_collected = true
    ↓
Route Builder: Shows "Collected" badge ✓

Delivery Confirmed:
─────────────────────
Shipday Webhook (status: "delivered")
    ↓
Updates: status, tracking_events, order_collected = true, order_delivered = true
    ↓
send-email (delivery_confirmation)
    ↓
Updates: delivery_confirmation_sent_at, order_delivered = true
    ↓
Order complete ✓
```

## Optional: Backfill Existing Data

For existing orders where the timestamp exists but the boolean is still false, you can run this SQL once:

```sql
UPDATE orders
SET 
  order_collected = true
WHERE collection_confirmation_sent_at IS NOT NULL 
  AND (order_collected IS NULL OR order_collected = false);

UPDATE orders
SET 
  order_delivered = true
WHERE delivery_confirmation_sent_at IS NOT NULL 
  AND (order_delivered IS NULL OR order_delivered = false);
```

## Summary

After this fix:
- `order_collected` will be set to `true` when status changes to "collected" or later
- `order_delivered` will be set to `true` when status changes to "delivered"
- RouteBuilder will correctly show collection status badges
- OptimoRoute sync will correctly skip pickup jobs for collected orders
