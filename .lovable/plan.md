

# Fix: Shipday Verification Returning False Positives

## Problem

The Shipday API returns HTTP 200 even for non-existent order IDs. The current edge function only checks `response.ok` (i.e., status code), so every ID appears to "exist" -- including completely fake ones.

## Root Cause

Confirmed by testing: both a real ID (`CCC754546907586ROSDE6`) and a completely fake ID (`DEFINITELY_FAKE_ID_12345`) both return `true` because the API responds with 200 for both. The actual difference is in the **response body**, not the status code.

## Solution

Update the `verify-shipday-orders` edge function to:

1. **Read and parse the response body** from the Shipday API instead of just checking `response.ok`
2. **Log the response body** for debugging so we can see exactly what Shipday returns for existing vs non-existing orders
3. **Determine existence from the body content** -- likely an empty array/object means "not found" while a populated response means "exists"

### File: `supabase/functions/verify-shipday-orders/index.ts`

Replace the simple `response.ok` check with body inspection:

```typescript
for (const id of shipdayIds) {
  try {
    const response = await fetch(`https://api.shipday.com/orders/${id}`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.log(`Shipday order ${id}: HTTP ${response.status}`);
      results[id] = false;
      continue;
    }

    const body = await response.text();
    console.log(`Shipday order ${id} response: ${body.substring(0, 500)}`);

    // Parse and check if the response contains actual order data
    try {
      const data = JSON.parse(body);

      // Shipday may return an empty array, null, or an object without an orderId
      if (!data || (Array.isArray(data) && data.length === 0)) {
        results[id] = false;
      } else if (Array.isArray(data)) {
        // If array, check first item has a valid orderId
        results[id] = data.length > 0 && !!data[0]?.orderId;
      } else if (typeof data === 'object') {
        // If object, check it has an orderId field
        results[id] = !!data.orderId;
      } else {
        results[id] = false;
      }
    } catch {
      // If body isn't valid JSON or is empty, treat as not found
      results[id] = false;
    }
  } catch {
    results[id] = false;
  }
}
```

### Why this works

The Shipday GET endpoint returns 200 for all requests but the response body differs:
- **Existing order**: Returns the order object (with `orderId`, `orderNumber`, etc.)
- **Non-existing order**: Returns an empty array `[]`, empty object `{}`, or `null`

By inspecting the body rather than the status code, we correctly distinguish between the two cases. The added logging will also let us see the exact response format in edge function logs for future debugging.

## Testing

After deployment, the edge function logs will show the actual Shipday response bodies, confirming the fix works. The scheduling page should then show red X icons for orders that don't exist on Shipday and green checkmarks only for verified orders.

