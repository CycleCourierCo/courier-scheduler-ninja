
# Add "Created via API" Flag to Orders

## Overview

This feature adds a boolean field to orders that indicates whether they were created through the external API (vs the web UI). This will help distinguish orders created programmatically by integrations from those created manually.

## Current State

Orders created via the API endpoint (`/functions/v1/orders`) and orders created through the web UI both look identical in the database. There's no way to distinguish the source of order creation.

## Proposed Changes

### 1. Database Schema

Add a new boolean column to the `orders` table:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `created_via_api` | BOOLEAN | `false` | Indicates if order was created via API |

### 2. Edge Function Update

Modify the orders edge function to set this flag to `true` when creating orders:

**File:** `supabase/functions/orders/index.ts`

```typescript
const orderData = {
  // ... existing fields
  created_via_api: true,  // Add this line
  status: 'created',
  tracking_number: trackingNumber,
  // ...
}
```

### 3. Type Definition Update

Add the field to the Order type:

**File:** `src/types/order.ts`

```typescript
export type Order = {
  // ... existing fields
  createdViaApi?: boolean;
};
```

### 4. Data Mapping Update

Map the database field to the frontend type:

**File:** `src/services/orderServiceUtils.ts`

```typescript
createdViaApi: dbOrder.created_via_api || false,
```

## Files to Modify

| File | Change |
|------|--------|
| Database | Add `created_via_api` boolean column |
| `supabase/functions/orders/index.ts` | Set `created_via_api: true` during order creation |
| `src/types/order.ts` | Add `createdViaApi` property |
| `src/services/orderServiceUtils.ts` | Map `created_via_api` to `createdViaApi` |

## Notes

- Existing orders will have `created_via_api = false` by default
- Web UI order creation does not need modification (default `false` applies)
- The field is optional in the frontend type to handle backward compatibility
