

# Receiver Confirmation Email and Reset Dates Button

## Overview

This plan covers two features:
1. Send a confirmation email to receivers when they confirm their availability dates (similar to sender confirmation email)
2. Add a "Reset Dates" button to clear the selected dates in the availability form

## Changes Required

### 1. Add Receiver Dates Confirmed Email Type

**File**: `supabase/functions/send-email/index.ts`

Add a new email type handler `receiver_dates_confirmed` that will:
- Thank the receiver for confirming their dates
- Display the dates they selected
- Explain what happens next (tailored for receiver perspective)

The email content will be:
- Subject: "Thanks for confirming your availability"
- List of selected delivery dates
- Tracking number and Track Order button
- "This is what happens next:" section with receiver-focused steps:
  1. We send you a timeslot the day before we are due on one of the dates you have selected
  2. You receive a tracking link when the driver is on the way to you
  3. Your bicycle will be delivered on the scheduled date

### 2. Add Email Service Function for Receiver

**File**: `src/services/emailService.ts`

Add a new function `sendReceiverDatesConfirmedEmail`:
```typescript
export const sendReceiverDatesConfirmedEmail = async (
  orderId: string, 
  selectedDates: string[]
): Promise<boolean>
```

This will:
- Fetch order details (receiver name, tracking number)
- Call the edge function with `emailType: 'receiver_dates_confirmed'`
- Return success/failure status

### 3. Trigger Email After Receiver Confirms

**File**: `src/services/availabilityService.ts`

Update both `confirmReceiverAvailability` and `updateReceiverAvailability` functions to:
- Import the new `sendReceiverDatesConfirmedEmail` function
- Call it after successfully updating the database
- Pass the selected dates to be displayed in the email

### 4. Add Reset Dates Button to Availability Form

**File**: `src/components/availability/AvailabilityForm.tsx`

Add a new prop and button:
- Add optional `onReset` callback prop to the interface
- Add a "Reset Dates" button in the "Selected Dates" section
- Style it as a secondary/outline button with an icon
- When clicked, clear all selected dates by calling `setDates([])`

## Email Template Design (Receiver)

```text
+-------------------------------------------------------------+
|  Hello [Receiver Name],                                     |
|                                                             |
|  Thank you for confirming your availability dates.          |
|                                                             |
|  +-------------------------------------------------------+  |
|  |  Your Selected Dates:                                 |  |
|  |  - Monday, 10 February 2025                           |  |
|  |  - Tuesday, 11 February 2025                          |  |
|  |  - Wednesday, 12 February 2025                        |  |
|  |                                                       |  |
|  |  Tracking Number: CCC-XXXXX                           |  |
|  |            [Track Order]                              |  |
|  +-------------------------------------------------------+  |
|                                                             |
|  This is what happens next:                                 |
|                                                             |
|  1. We send you a timeslot the day before we are due on     |
|     one of the dates you have selected                      |
|  2. You receive a tracking link when the driver is on       |
|     the way to you                                          |
|  3. Your bicycle will be delivered on the scheduled date    |
|                                                             |
|  Thank you,                                                 |
|  The Cycle Courier Co. Team                                 |
+-------------------------------------------------------------+
```

## Reset Button Design

The button will appear in the "Selected Dates" section:

```text
+---------------------------------------+
|  Selected Dates                       |
|                                       |
|  [Mon, Feb 10] [Tue, Feb 11] [x]     |
|                                       |
|  [Reset Dates]  <- New outline button |
+---------------------------------------+
```

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/send-email/index.ts` | Add `receiver_dates_confirmed` email type handler |
| `src/services/emailService.ts` | Add `sendReceiverDatesConfirmedEmail` function |
| `src/services/availabilityService.ts` | Import and call receiver confirmation email after update |
| `src/components/availability/AvailabilityForm.tsx` | Add Reset Dates button with clear functionality |

## Implementation Order

1. Add the `receiver_dates_confirmed` email type to the edge function
2. Add the `sendReceiverDatesConfirmedEmail` service function
3. Update `confirmReceiverAvailability` and `updateReceiverAvailability` to trigger the email
4. Add the Reset Dates button to the AvailabilityForm component

