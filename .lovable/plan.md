

## Fix Timeslip Generation Accuracy

### Root Cause
The `query-database-completed-jobs` edge function fetches **all orders ever** that have a confirmation timestamp, then filters by date in JavaScript. Supabase's default 1000-row limit silently truncates results, so many of yesterday's confirmed orders never make it into the timeslip calculations.

### The Fix

**`supabase/functions/query-database-completed-jobs/index.ts`** — Add server-side date filtering to both queries:

1. Instead of fetching all orders with a confirmation timestamp and filtering in JS, add `.gte()` and `.lt()` filters on `collection_confirmation_sent_at` and `delivery_confirmation_sent_at` to restrict to a 2-day window around the target date (to account for timezone differences between UTC and UK time).

2. Remove the 1000-row default limit issue by explicitly calling `.limit(10000)` or paginating — though with date filtering, volumes should be well under 1000.

The change replaces lines 72-76 (collections query) with:
```typescript
// Calculate date range for server-side filtering (2-day window for timezone safety)
const dateStart = `${date}T00:00:00.000Z`;
const dateEnd = new Date(new Date(date + 'T00:00:00Z').getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();

const { data: collectionsData, error: collectionsError } = await supabaseClient
  .from('orders')
  .select('id, tracking_number, sender, collection_driver_name, collection_confirmation_sent_at, bike_quantity')
  .not('collection_confirmation_sent_at', 'is', null)
  .not('collection_driver_name', 'is', null)
  .gte('collection_confirmation_sent_at', dateStart)
  .lt('collection_confirmation_sent_at', dateEnd);
```

Same pattern for the deliveries query (lines 84-88).

The existing JS date filtering (lines 97-115) stays as a secondary safety net for exact UK timezone matching.

### Files Modified
- `supabase/functions/query-database-completed-jobs/index.ts` — Add date range filters to both queries

### After Deployment
Re-generate yesterday's timeslips from the UI to get accurate numbers.

