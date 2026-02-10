

# Fix: Use Shipday "Retrieve Active Orders" Endpoint

## Problem

The current approach calls `GET /orders/{id}` per order, but that endpoint expects an `orderNumber` string, not the numeric `orderId` we store. This causes all lookups to fail.

## Solution

Replace the per-order lookup with a single call to `GET https://api.shipday.com/orders` (the "Retrieve Active Orders" endpoint). This returns all active orders in one array. We then build a Set of `orderId` values from the response and check our local Shipday IDs against it.

This is simpler, faster (1 API call instead of N), and uses the numeric `orderId` field which matches what we store in the database.

## Changes

### File: `supabase/functions/verify-shipday-orders/index.ts`

Replace the entire per-order loop with:

1. Single `GET https://api.shipday.com/orders` call with `Authorization: Basic {apiKey}`
2. Parse the response array and build a Set of all `orderId` values (converted to strings for comparison)
3. For each local Shipday ID, check if it exists in the Set
4. Return results as before: `{ results: { "43073703": true, "99999": false } }`

```text
Current flow (N API calls, broken):
  For each shipdayId -> GET /orders/{shipdayId} -> parse body

New flow (1 API call):
  GET /orders -> get all active orders array
  Build Set of orderId strings from response
  For each shipdayId -> check if Set.has(shipdayId)
```

No frontend changes needed -- the input/output contract stays the same (`shipdayIds` in, `results` map out).

## Technical Details

- The active orders endpoint returns an array of order objects, each with an `orderId` field (numeric)
- Our database stores `shipday_pickup_id` and `shipday_delivery_id` as strings of the numeric orderId
- We convert the response `orderId` values to strings for Set lookup
- If the API call fails, all IDs are marked as `false` with an error log

