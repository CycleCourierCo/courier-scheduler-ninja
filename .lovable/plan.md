

# Shipday Job Verification on Scheduling Page

## Overview

Add visual indicators showing whether each job exists on Shipday, plus aggregate counts in the Route Builder header. This will help identify jobs that have disappeared from Shipday.

## Approach

### 1. New Edge Function: `verify-shipday-orders`

Create an edge function that accepts an array of Shipday order IDs and checks each against the Shipday API (`GET https://api.shipday.com/orders/{orderId}`). Returns a map of `{ shipdayId: boolean }` indicating existence.

- Batch verification to minimize API calls
- Uses the existing `SHIPDAY_API_KEY` secret
- Returns `{ results: { "123": true, "456": false } }`

### 2. Update `OrderData` Type

Add `shipday_pickup_id` and `shipday_delivery_id` to the `OrderData` interface in `JobScheduling.tsx`. The query already fetches all columns via `select('*')`, so these fields are already in the data -- they just need to be typed.

### 3. Shipday Status on Job Cards (Available Jobs List)

On each job card in the available jobs list (the grid of cards users click to add to the route), show:
- A small Shipday logo/icon if the corresponding Shipday ID exists on Shipday
- A red X icon if the Shipday ID is missing from Shipday
- A grey dash if no Shipday ID is stored locally (never synced)

The check is based on job type: for pickup jobs, check `shipday_pickup_id`; for delivery jobs, check `shipday_delivery_id`.

### 4. Shipday Status on Route Builder Job Items

Same indicators on the draggable job items in the built route.

### 5. Aggregate Counts in Route Builder Header

Update the Route Builder header badges (currently shows collections, deliveries, total jobs) to also display:
- **On Shipday**: count of jobs where the Shipday ID was verified as existing
- **Not on Shipday**: count of jobs where either no Shipday ID exists locally OR the Shipday API confirmed it's missing

### 6. Verification Flow

When the scheduling page loads, after orders are fetched:
1. Collect all non-null `shipday_pickup_id` and `shipday_delivery_id` values
2. Call the `verify-shipday-orders` edge function with this batch
3. Store verification results in state
4. Display indicators on cards based on results

A "Re-verify Shipday" button will allow manual refresh of the verification status.

## Technical Details

### Files to Create
- `supabase/functions/verify-shipday-orders/index.ts` -- new edge function

### Files to Modify
- `src/pages/JobScheduling.tsx` -- add `shipday_pickup_id` and `shipday_delivery_id` to `OrderData` type; add verification state and query
- `src/components/scheduling/RouteBuilder.tsx` -- accept verification results as prop; display Shipday indicators on job cards and route items; add Shipday counts to header badges

### Edge Function Logic

```
POST /verify-shipday-orders
Body: { shipdayIds: string[] }
Response: { results: { [id: string]: boolean } }
```

For each ID, call `GET https://api.shipday.com/orders/{id}` with the API key. A 200 response means the job exists; 404 or error means it doesn't.

### UI Indicators

- Verified on Shipday: green checkmark or small Shipday-themed icon
- Missing from Shipday: red X icon (`X` from lucide-react with red color)
- Never synced (no local ID): grey minus/dash icon
