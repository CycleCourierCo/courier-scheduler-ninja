

## Fix Return Order Toast Navigation

### Problem
When creating a return order from the Customer Order Detail page, the "View Order" toast action navigates to `/customer-order/{id}` (singular), but the actual route is `/customer-orders/{id}` (plural). This results in a 404/NotFound page.

### Fix
**File: `src/pages/CustomerOrderDetail.tsx`** — line 163

Change:
```typescript
onClick: () => navigate(`/customer-order/${newOrder.id}`),
```
To:
```typescript
onClick: () => navigate(`/customer-orders/${newOrder.id}`),
```

One line, one character change.

