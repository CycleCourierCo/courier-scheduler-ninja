

# Send Confirmation Email to Sender After Date Selection

## Overview

When a sender confirms their availability dates, send them a confirmation email thanking them and explaining what happens next in the process.

## Changes Required

### 1. Add New Email Type in Edge Function

**File**: `supabase/functions/send-email/index.ts`

Add a new email type handler for `sender_dates_confirmed` that will:
- Thank the sender for confirming their dates
- Display the dates they selected
- Explain the next steps in the process

```
Subject: Thanks for confirming your availability

Email content:
- Greeting with sender name
- Thank you message
- Grey box showing:
  - Their selected dates (formatted nicely)
  - Track Order button
- "This is what happens next:" section with:
  1. We send you a timeslot the day before we are due on one of the dates you have selected
  2. You receive a tracking link when the driver is on the way to you
  3. The bike is delivered to the receiver based on their dates for availability
```

### 2. Add Email Service Function

**File**: `src/services/emailService.ts`

Add a new function `sendSenderDatesConfirmedEmail` that:
- Fetches the order details
- Sends the confirmation email with the selected dates
- Includes the tracking number and tracking link

```typescript
export const sendSenderDatesConfirmedEmail = async (
  orderId: string, 
  selectedDates: string[]
): Promise<boolean>
```

### 3. Trigger Email After Sender Confirms

**File**: `src/services/availabilityService.ts`

Update both `confirmSenderAvailability` and `updateSenderAvailability` functions to:
- Import and call the new `sendSenderDatesConfirmedEmail` function
- Pass the selected dates to be displayed in the email

The email will be sent right after the database is updated and before the receiver availability email is sent.

## Email Template Design

```text
┌─────────────────────────────────────────────────────────────┐
│  Hello [Sender Name],                                       │
│                                                             │
│  Thank you for confirming your availability dates.         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Your Selected Dates:                               │   │
│  │  - Monday, 10 February 2025                         │   │
│  │  - Tuesday, 11 February 2025                        │   │
│  │  - Wednesday, 12 February 2025                      │   │
│  │                                                     │   │
│  │  Tracking Number: CCC-XXXXX                         │   │
│  │            [Track Order]                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  This is what happens next:                                │
│                                                             │
│  1. We send you a timeslot the day before we are due on    │
│     one of the dates you have selected                     │
│  2. You receive a tracking link when the driver is on      │
│     the way to you                                         │
│  3. The bike is delivered to the receiver based on their   │
│     dates for availability                                 │
│                                                             │
│  Thank you,                                                 │
│  The Cycle Courier Co. Team                                │
└─────────────────────────────────────────────────────────────┘
```

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/send-email/index.ts` | Add `sender_dates_confirmed` email type handler |
| `src/services/emailService.ts` | Add `sendSenderDatesConfirmedEmail` function |
| `src/services/availabilityService.ts` | Call the new email function after sender confirms |

