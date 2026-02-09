
# Fix: Part Exchange Orders - Shipday Integration and Bike Type

## Problems Identified

When a part exchange order is created, the system creates two orders:
1. **Main order**: Collect bike from sender → Deliver to receiver
2. **Reverse order**: Collect part exchange bike from receiver → Deliver back to sender

### Current Issues

| Issue | Description |
|-------|-------------|
| Missing Bike Type | Part exchange only asks for Brand and Model, but Bike Type is mandatory for logistics |
| No Shipday for Reverse Order | Reverse order is created without Shipday pickup/delivery jobs |
| No Emails for Reverse Order | Reverse order doesn't trigger availability or notification emails |

### Current Flow
```text
User creates Part Exchange order
         ↓
Main Order created ✅
         ↓
Shipday jobs created for Main Order ✅
         ↓
Emails sent for Main Order ✅
         ↓
Reverse Order created ✅
         ↓
No Shipday jobs for Reverse Order ❌
         ↓
No Bike Type on Reverse Order ❌
```

## Solution

### 1. Add Part Exchange Bike Type Field

**Files to modify:**
- `src/types/order.ts` - Add `partExchangeBikeType` to `CreateOrderFormData`
- `src/components/create-order/OrderOptions.tsx` - Add bike type dropdown for part exchange
- `src/pages/CreateOrder.tsx` - Add validation and default value for part exchange bike type

**Form additions:**
```typescript
// Add to OrderOptions.tsx when isBikeSwap is true
<FormField
  control={control}
  name="partExchangeBikeType"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Part Exchange Bike Type *</FormLabel>
      <Select onValueChange={field.onChange} value={field.value || ""}>
        {/* Same BIKE_TYPES dropdown as OrderDetails */}
      </Select>
    </FormItem>
  )}
/>
```

### 2. Update Reverse Order Creation with Bike Type + Shipday

**File to modify:** `src/services/orderService.ts`

Changes to the reverse order creation:
1. Accept `partExchangeBikeType` from the form data
2. Include `bike_type` in the reverse order insert
3. Create Shipday jobs for the reverse order after successful creation

```typescript
// In createOrder function, update reverse order creation:
if (isBikeSwap && partExchangeBikeBrand && partExchangeBikeModel && partExchangeBikeType) {
  try {
    const reverseTrackingNumber = await generateTrackingNumber(receiver.name, sender.address.zipCode);
    
    const { data: reverseOrder, error: reverseError } = await supabase
      .from("orders")
      .insert({
        // ... existing fields ...
        bike_brand: partExchangeBikeBrand,
        bike_model: partExchangeBikeModel,
        bike_type: partExchangeBikeType,  // NEW: Add bike type
        // ...
      })
      .select()
      .single();
    
    // NEW: Create Shipday jobs for reverse order
    if (reverseOrder && !reverseError) {
      try {
        const { createShipdayOrder } = await import('@/services/shipdayService');
        await createShipdayOrder(reverseOrder.id);
        console.log('Created Shipday jobs for reverse order:', reverseOrder.id);
      } catch (shipdayError) {
        console.error('Failed to create Shipday jobs for reverse order:', shipdayError);
      }
    }
  } catch (reverseOrderError) {
    console.error('Failed to create reverse order:', reverseOrderError);
  }
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/order.ts` | Add `partExchangeBikeType?: string` to `CreateOrderFormData` |
| `src/components/create-order/OrderOptions.tsx` | Add Bike Type dropdown for part exchange |
| `src/pages/CreateOrder.tsx` | Add `partExchangeBikeType` to schema, validation, and default values |
| `src/services/orderService.ts` | Extract `partExchangeBikeType`, include in reverse order insert, and create Shipday jobs |

## Summary of Changes

### UI Form Changes
- Add new "Part Exchange Bike Type" dropdown (same options as main bike types)
- Required when Part Exchange toggle is enabled
- Clear field when toggle is disabled

### Backend Logic Changes
- Include `bike_type` when creating the reverse order
- After successful reverse order creation, call `createShipdayOrder(reverseOrder.id)` to add Shipday pickup and delivery jobs

## Testing

After implementation:
1. Create a new order with Part Exchange enabled
2. Verify the new Bike Type dropdown appears and is required
3. Verify both orders are created in the database (main + reverse)
4. Verify both orders have Shipday IDs populated
5. Check Shipday dashboard to confirm 4 jobs total (2 for main, 2 for reverse)
