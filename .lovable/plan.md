

# Add Admin Reset Buttons for Sender/Receiver Availability Dates

## Overview

Add buttons on the admin order details page that allow admins to reset the sender/receiver availability dates. This is **different** from the existing "Reset Collection/Delivery Date" buttons which reset the admin-scheduled dates.

| Feature | What it resets | Current State |
|---------|---------------|---------------|
| Reset Collection Date | `scheduled_pickup_date` (admin-set) | Already exists |
| Reset Delivery Date | `scheduled_delivery_date` (admin-set) | Already exists |
| **Reset Sender Availability** | `pickup_date` (customer-submitted) | **New** |
| **Reset Receiver Availability** | `delivery_date` (customer-submitted) | **New** |

## Changes Required

### 1. Add Reset Handler Functions

**File**: `src/pages/OrderDetail.tsx`

Add two new async functions following the existing pattern:

**handleResetSenderAvailability:**
- Clears `pickup_date` (the sender's selected dates)
- Clears `sender_confirmed_at` 
- Clears `sender_notes`
- Resets status to `sender_availability_pending`
- Triggers `resendSenderAvailabilityEmail` to notify the sender to reselect dates

**handleResetReceiverAvailability:**
- Clears `delivery_date` (the receiver's selected dates)
- Clears `receiver_confirmed_at`
- Clears `receiver_notes`
- Resets status to `receiver_availability_pending`
- Triggers `resendReceiverAvailabilityEmail` to notify the receiver to reselect dates

### 2. Add UI Buttons

**File**: `src/pages/OrderDetail.tsx`

Add the reset buttons below the Sender/Receiver Availability cards (around line 1204), styled as outline buttons with a warning color to differentiate from the destructive "Reset Collection/Delivery Date" buttons:

```
+-------------------------------------------+
| Sender Availability       | Receiver Availability    |
| [Dates...]                | [Dates...]               |
| [Reset Sender Avail.]     | [Reset Receiver Avail.]  |
+-------------------------------------------+
```

### 3. Remove Reset Button from Customer Form (Cleanup)

**File**: `src/components/availability/AvailabilityForm.tsx`

The Reset button that was previously added to the customer-facing form should be removed, as customers should not be able to clear their dates once they start selecting them. This also prevents confusion between the customer experience and admin controls.

## Implementation Details

### New Handler Functions

```typescript
const handleResetSenderAvailability = async () => {
  if (!id) return;
  try {
    setIsSubmitting(true);
    const { error } = await supabase
      .from('orders')
      .update({
        pickup_date: null,
        sender_confirmed_at: null,
        sender_notes: null,
        status: 'sender_availability_pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
    
    // Resend availability email
    await resendSenderAvailabilityEmail(id);
    
    toast.success("Sender availability reset. Email sent.");
    // Refresh order
    const updatedOrder = await getOrderById(id);
    if (updatedOrder) setOrder(updatedOrder);
  } catch (error) {
    toast.error("Failed to reset sender availability");
  } finally {
    setIsSubmitting(false);
  }
};
```

(Similar pattern for receiver)

### Button Styling

The buttons will use `variant="outline"` with amber/orange border colors to indicate a warning-level action (different from red "destructive" for scheduled date resets):

```tsx
<Button 
  onClick={handleResetSenderAvailability}
  variant="outline"
  size="sm"
  className="w-full border-amber-500 text-amber-700 hover:bg-amber-50"
  disabled={isSubmitting || !order.pickupDate}
>
  Reset Sender Availability
</Button>
```

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/OrderDetail.tsx` | Add `handleResetSenderAvailability` and `handleResetReceiverAvailability` functions, add UI buttons |
| `src/components/availability/AvailabilityForm.tsx` | Remove the Reset button from customer form |

## User Flow After Reset

1. Admin clicks "Reset Sender Availability"
2. Database clears sender's dates, resets status to pending
3. Sender receives a new email asking them to select dates again
4. Sender fills out the form and submits
5. Flow continues as normal (receiver email sent, etc.)

