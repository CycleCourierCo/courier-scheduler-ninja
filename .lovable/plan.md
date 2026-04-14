

## Fix: Move BST adjustment after date variable declarations

### Root cause
The BST fix placed the `adjustTimeForShipday()` calls on lines 182-190, but `expectedPickupDateFormatted` and `expectedDeliveryDateFormatted` aren't declared until lines 193-206. This causes `ReferenceError: Cannot access before initialization` every time the function runs, breaking all Shipday order creation.

### Fix
**File: `supabase/functions/create-shipday-order/index.ts`**

Move the BST adjustment block (lines 181-190) to after line 206 (after both date variables are declared and assigned). The reordered code:

1. Lines 178-179: Parse timeslots (unchanged)
2. Lines 193-206: Declare and assign `expectedPickupDateFormatted` and `expectedDeliveryDateFormatted` (unchanged)
3. **Then** apply BST adjustments and logging

Specifically:
- Remove lines 181-190 (the `adjustTimeForShipday` calls and BST logging)
- Insert them after line 209 (after the date console.log statements)

Then redeploy the `create-shipday-order` edge function.

