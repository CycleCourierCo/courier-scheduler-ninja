

## Make Bike Value Mandatory on Frontend Only

### Changes

**1. Create Order form validation (`src/pages/CreateOrder.tsx`, line 92)**

Change the bikes schema value field from optional to required:
```typescript
value: z.string().min(1, "Bike value is required"),
```

Also make `partExchangeBikeValue` required when bike swap is active (line 101).

**2. Create Order form label (`src/components/create-order/OrderDetails.tsx`, line 130)**

Add asterisk to indicate required field:
```
Bike {index + 1} Value (£) *
```

**3. Bulk upload validation (`src/services/bulkOrderService.ts`, line 292-294)**

Add value validation for each bike in `validateGroupedOrder`:
```typescript
if (!bike.value) errors.push({ field: `bike_${i}_value`, message: `Bike ${i + 1}: value is required` });
```

Update the `bikes` type parameter to include `value` field.

**4. API remains unchanged** — `bike_value` stays optional in the edge function and API docs.

