
# Route Report Email After All Timeslots Sent

## Overview

After all timeslots have been sent via WhatsApp, email, and Shipday, send a comprehensive route report email to `info@cyclecourierco.com` summarizing:

1. The exact route with stop sequence and timeslots
2. Number of bikes onboard at each stop
3. Status of each notification channel (WhatsApp, Shipday, Email)

---

## Implementation Approach

### Option 1: Create New Edge Function (Recommended)

Create a dedicated edge function `send-route-report` that receives the full route data and sends an HTML-formatted email report.

**Benefits:**
- Separation of concerns
- Reusable for future reporting needs
- Clean HTML email template

### Option 2: Extend Frontend Logic

Build the report in the frontend and call the existing `send-email` edge function.

**Chosen Approach:** Option 1 - dedicated edge function for cleaner architecture and better email formatting.

---

## Technical Plan

### 1. Create New Edge Function: `send-route-report`

**File:** `supabase/functions/send-route-report/index.ts`

**Request Payload:**
```typescript
interface RouteReportRequest {
  date: string;                    // "2024-02-06"
  startTime: string;               // "09:00"
  startingBikes: number;           // Initial bike count
  stops: Array<{
    sequence: number;              // 1, 2, 3...
    type: 'pickup' | 'delivery' | 'break';
    contactName: string;
    address: string;
    estimatedTime: string;         // "10:30"
    bikesOnboard: number;          // After this stop
    bikeQuantity: number;          // Bikes at this stop
    trackingNumber?: string;
    bikeBrand?: string;
    bikeModel?: string;
    breakDuration?: number;        // For breaks
    breakType?: 'lunch' | 'stop';
    results: {
      whatsapp: { success: boolean; error?: string };
      shipday: { success: boolean; error?: string };
      email: { success: boolean; error?: string };
    };
  }>;
  summary: {
    totalStops: number;
    totalPickups: number;
    totalDeliveries: number;
    totalBreaks: number;
    whatsappSuccess: number;
    whatsappFailed: number;
    shipdaySuccess: number;
    shipdayFailed: number;
    emailSuccess: number;
    emailFailed: number;
  };
}
```

**Email Template:**
- Header with date and route summary
- Table showing each stop with:
  - Sequence number
  - Time
  - Type (Collection/Delivery/Break)
  - Contact name
  - Address
  - Bikes onboard after stop
  - Status icons for WhatsApp, Shipday, Email
- Summary section with totals

---

### 2. Update Frontend: `sendAllTimeslots` Function

**File:** `src/components/scheduling/RouteBuilder.tsx`

**Changes:**

1. **Track detailed results** - Instead of just success/failure counts, collect full result data for each job
2. **Calculate bike count at each stop** - Using existing `calculateBikeCountAtJob` logic
3. **Call route report edge function** - After all timeslots are sent, invoke `send-route-report`

**Data Collection Structure:**
```typescript
interface JobResult {
  job: SelectedJob;
  bikeCount: number;
  results: {
    whatsapp: { success: boolean; error?: string };
    shipday: { success: boolean; error?: string };
    email: { success: boolean; error?: string };
  };
}
```

---

## Email Template Design

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  🚴 ROUTE REPORT - Thursday, 6 February 2024                                 │
│  Start Time: 09:00 | Starting Bikes: 3                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ROUTE SUMMARY                                                               │
│  ────────────────────────────────────────────────────────────────────────    │
│  Total Stops: 8 | Collections: 3 | Deliveries: 4 | Breaks: 1                 │
│                                                                              │
├───────┬────────┬─────────┬─────────────────────────┬───────┬────────────────┤
│ #     │ Time   │ Type    │ Contact / Address       │ 🚲    │ Status         │
├───────┼────────┼─────────┼─────────────────────────┼───────┼────────────────┤
│ 1     │ 09:45  │ 📦 Del  │ John Smith              │ 2     │ ✅ ✅ ✅       │
│       │        │         │ 123 High St, B1 2AB     │       │ WA SD EM       │
├───────┼────────┼─────────┼─────────────────────────┼───────┼────────────────┤
│ 2     │ 10:30  │ 📥 Col  │ Jane Doe                │ 3     │ ✅ ✅ ❌       │
│       │        │         │ 456 Oak Lane, B5 4CD    │       │ WA SD EM       │
├───────┼────────┼─────────┼─────────────────────────┼───────┼────────────────┤
│ 3     │ 12:00  │ 🍽️ Brk  │ Lunch Break (60min)     │ 3     │ ---            │
├───────┴────────┴─────────┴─────────────────────────┴───────┴────────────────┤
│                                                                              │
│  NOTIFICATION SUMMARY                                                        │
│  ────────────────────────────────────────────────────────────────────────    │
│  WhatsApp: 7 sent, 1 failed                                                  │
│  Shipday:  8 updated, 0 failed                                               │
│  Email:    6 sent, 2 failed                                                  │
│                                                                              │
│  Final Bikes Onboard: 2                                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/send-route-report/index.ts` | Create | New edge function for route report email |
| `src/components/scheduling/RouteBuilder.tsx` | Modify | Update `sendAllTimeslots` to track results and send report |

---

## Implementation Details

### Edge Function: `send-route-report`

```typescript
// Key components:
1. Parse request payload
2. Build HTML email with:
   - Route header (date, start time, starting bikes)
   - Summary stats
   - Stop-by-stop table with status indicators
   - Notification summary
3. Send via Resend to info@cyclecourierco.com
4. Return success/failure response
```

### Frontend Changes: `sendAllTimeslots`

```typescript
// Current flow:
1. Process grouped locations → track results
2. Process standalone jobs → track results
3. Show toast summary

// New flow:
1. Process grouped locations → track detailed results per job
2. Process standalone jobs → track detailed results per job
3. Build route report payload with:
   - All stops in sequence order
   - Bike count at each stop
   - Individual notification results
4. Call send-route-report edge function
5. Show toast summary (include report status)
```

---

## Handling Grouped Locations

When multiple jobs are at the same location (grouped):
- Each job is still tracked individually in the report
- They share the same estimated time
- Bike count changes per job (deliveries first, then pickups)
- Each job has its own notification status (since Shipday is per-order)

---

## Edge Cases

1. **Breaks** - Included in report but no notifications (shown as `---`)
2. **Failed jobs** - Still included with failure status and error message
3. **Missing data** - Graceful fallbacks for missing brand/model/tracking
4. **No jobs sent** - Skip report if no jobs were successfully processed

---

## Summary

| Task | Description |
|------|-------------|
| Create `send-route-report` edge function | HTML email with route table and status summary |
| Update `sendAllTimeslots` | Collect detailed results and call report function |
| Track bike counts | Use existing calculation logic per stop |
| Status indicators | Show WhatsApp, Shipday, Email status per job |
| Send to management | Email to `info@cyclecourierco.com` |
