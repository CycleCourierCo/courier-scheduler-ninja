
# Add Tracking Number to Sender Availability Email

## Overview

Update the sender availability confirmation email to include the tracking number in:
1. The email subject line
2. The email body with a tracking link

## Current State

**Frontend (`src/services/emailService.ts`)**:
- `sendSenderAvailabilityEmail` passes: `to`, `name`, `orderId`, `baseUrl`, `emailType`, `item`
- Missing: `trackingNumber`

**Edge Function (`supabase/functions/send-email/index.ts`)**:
- Subject: `"Please confirm your pickup availability"` (no tracking number)
- Body: Shows item name and quantity but no tracking number or link

## Changes Required

### 1. Update Frontend Service

**File**: `src/services/emailService.ts`

Add `trackingNumber` to the request body in `sendSenderAvailabilityEmail`:

```typescript
const response = await supabase.functions.invoke("send-email", {
  body: {
    to: order.sender.email,
    name: order.sender.name || "Sender",
    orderId: id,
    baseUrl,
    emailType: "sender",
    item: item,
    trackingNumber: order.trackingNumber  // NEW
  }
});
```

Also update `sendReceiverAvailabilityEmail` for consistency.

### 2. Update Edge Function

**File**: `supabase/functions/send-email/index.ts`

Update the `emailType === 'sender' || emailType === 'receiver'` handler:

**Subject Line** (line 89):
```typescript
// Before
emailOptions.subject = `Please confirm your ${availabilityType} availability`;

// After
const trackingNumber = reqData.trackingNumber || '';
emailOptions.subject = trackingNumber 
  ? `${trackingNumber} - Please confirm your ${availabilityType} availability`
  : `Please confirm your ${availabilityType} availability`;
```

**Email Body** - Add tracking info box and link after the item details:
```html
<div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p><strong>${item.name}</strong> (Quantity: ${item.quantity})</p>
  <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
</div>
<p>You can track your order's progress:</p>
<div style="text-align: center; margin: 20px 0;">
  <a href="${trackingUrl}" style="background-color: #6b7280; color: white; padding: 10px 16px; text-decoration: none; border-radius: 5px;">
    Track Order
  </a>
</div>
```

## Technical Details

| File | Lines | Change |
|------|-------|--------|
| `src/services/emailService.ts` | 476-485 | Add `trackingNumber: order.trackingNumber` to sender request body |
| `src/services/emailService.ts` | 539-548 | Add `trackingNumber: order.trackingNumber` to receiver request body |
| `supabase/functions/send-email/index.ts` | 79-122 | Extract `trackingNumber`, update subject, add tracking info to HTML/text body |

## Result

**Before**:
- Subject: `Please confirm your pickup availability`
- Body: Item details only

**After**:
- Subject: `CCC-123456 - Please confirm your pickup availability`
- Body: Item details + tracking number + "Track Order" button linking to `/tracking/CCC-123456`
