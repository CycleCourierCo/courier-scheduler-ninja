

## Update Bulk Upload to Match Create Order Multi-Bike Format

The Create Order form already handles this correctly (line 330-332 in `CreateOrder.tsx`), setting `bikeBrand: 'Multiple bikes'`, `bikeModel: '{N} bikes'`, `bikeType: 'Multiple types'` when there are multiple bikes. The bulk upload service just needs to follow the same pattern.

### Change

**File: `src/services/bulkOrderService.ts`** — in `groupedOrderToFormData`, update the legacy fields:

```typescript
// Before
bikeBrand: order.bikes[0]?.brand,
bikeModel: order.bikes[0]?.model,
bikeType: order.bikes[0]?.type,

// After
bikeBrand: order.bikes.length > 1 ? 'Multiple bikes' : (order.bikes[0]?.brand || ''),
bikeModel: order.bikes.length > 1 ? `${order.bikes.length} bikes` : (order.bikes[0]?.model || ''),
bikeType: order.bikes.length > 1 ? 'Multiple types' : (order.bikes[0]?.type || ''),
```

Single file, 3 lines changed.

