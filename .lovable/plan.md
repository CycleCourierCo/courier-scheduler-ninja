## Root cause

`#1137` has **13 bikes** in the CSV. The `orders` table has a CHECK constraint:

```
orders_bike_quantity_check: CHECK ((bike_quantity >= 1) AND (bike_quantity <= 8))
```

`createOrder()` inserts `bike_quantity: 13`, Postgres rejects the row, and the error bubbles up as a per-order failure inside `createBulkOrders`. It's captured in `results[]` and shown in a tooltip on the row's status icon — but only if the user is still on the Bulk Upload page after submit. Once they navigate away there's no persistent record, which is why the customer thought the upload silently dropped the order.

All other 21 orders in both uploads went through fine (verified in DB — each appears twice, matching bike counts).

## Changes

### 1. Raise the DB limit
The customer legitimately has 13-bike orders. Change the constraint to allow up to **20 bikes**:

```sql
ALTER TABLE public.orders DROP CONSTRAINT orders_bike_quantity_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_bike_quantity_check
  CHECK (bike_quantity >= 1 AND bike_quantity <= 20);
```

### 2. Pre-flight validation in `bulkOrderService.ts`
In `validateGroupedOrder`, push a clear error when `bikes.length > 20`:

```
"Order has X bikes; max 20 per order. Split into multiple orders."
```

This flags the row red in the preview table before submit, matching how missing-field errors already work.

### 3. Better error surfacing after submit
In `src/pages/BulkOrderUpload.tsx`:
- After `createBulkOrders` completes, when `failCount > 0` render a **persistent failed-orders panel** above the table listing each failed `orderNumber` with its error message (not just the tooltip on the icon).
- Change the completion toast from `toast.warning` to a `toast.error` that names the failed order numbers, e.g. `"Failed: #1137 — bike_quantity exceeds limit"`.
- Log each failure to Sentry with the order number and bike count as attributes (currently only the exception object is captured, not the context).

### 4. Backfill the missing order
`#1137` for MTB Monster is not in the DB. After the constraint is raised, the customer can re-run just that order via the normal Create Order flow or a fresh bulk upload containing only `#1137`. No migration backfill — we don't have the original submitter's `user_id` context to attribute it safely.

## Files touched
- `supabase/migrations/<new>.sql` — raise constraint to 20
- `src/services/bulkOrderService.ts` — add >20 validation in `validateGroupedOrder`
- `src/pages/BulkOrderUpload.tsx` — persistent failed-order panel + richer toast + Sentry context

## Out of scope
- Splitting oversized orders automatically (would change customer intent)
- Any change to Shipday / invoicing flow for orders with >8 bikes (assumed already handled since existing 5-bike orders work)
