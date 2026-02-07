

# Update Receiver Collection Confirmation Email

## Overview

When a bike is collected, the receiver receives an email notification. This plan updates that email to:
1. Remove "On Its Way" from the subject line
2. Add a "What happens next" section explaining the timeslot notification process

## Current State

**Current Subject Line (line 641):**
```
Bike Collected - On Its Way - CCC-XXXXX
```

**Current Email Body:**
- Greeting
- "Great news! Your bicycle has been collected and is now on its way to you."
- Order details box
- Track Your Delivery button
- "We'll notify you when your bicycle is out for delivery."

## Proposed Changes

### 1. Update Subject Line

**New Subject:**
```
Bike Collected - CCC-XXXXX
```

Simply remove the "On Its Way" portion to make the subject cleaner.

### 2. Update Email Body Content

**Updated Message:**
- Change "...and is now on its way to you" to "...and is now with us"
- Add "What happens next" section after the order details box

**New "What happens next" section:**
```
This is what happens next:

1. We send you a timeslot the day before we are due to deliver
2. You receive a tracking link when the driver is on the way to you
3. Your bicycle will be delivered on the scheduled date
```

## Updated Email Template Design

```text
+-------------------------------------------------------------+
|  Dear [Receiver Name],                                      |
|                                                             |
|  Great news! Your bicycle has been collected and is now     |
|  with us.                                                   |
|                                                             |
|  +-------------------------------------------------------+  |
|  |  Order Details:                                       |  |
|  |  - Tracking Number: CCC-XXXXX                         |  |
|  |  - Bicycle: Brand Model                               |  |
|  |                                                       |  |
|  |            [Track Your Delivery]                      |  |
|  +-------------------------------------------------------+  |
|                                                             |
|  This is what happens next:                                 |
|                                                             |
|  1. We send you a timeslot the day before we are due to     |
|     deliver                                                 |
|  2. You receive a tracking link when the driver is on       |
|     the way to you                                          |
|  3. Your bicycle will be delivered on the scheduled date    |
|                                                             |
|  Best regards,                                              |
|  The Cycle Courier Co. Team                                 |
+-------------------------------------------------------------+
```

## File to Modify

| File | Change |
|------|--------|
| `supabase/functions/send-email/index.ts` | Update receiver email in `handleCollectionConfirmation` function (lines 616-641) |

## Specific Code Changes

**Line 619**: Change message from "...and is now on its way to you" to "...and is now with us"

**Line 632-633**: Replace "We'll notify you when your bicycle is out for delivery." with the "What happens next" section

**Line 641**: Change subject from `Bike Collected - On Its Way - ${tracking}` to `Bike Collected - ${tracking}`

