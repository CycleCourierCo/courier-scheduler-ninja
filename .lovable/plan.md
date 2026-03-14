

## Add Bike Value to Order Creation, Part Exchange, and Item Details Display

### Overview
Add an optional "Bike Value (£)" field when creating orders (for each bike and for part exchanges), store it in the existing `bikes` JSONB column and a new `bike_value` DB column, and display bike value + bike type in the Item Details section on the order detail page.

### Changes

**1. Database** — Add `bike_value` column:
```sql
ALTER TABLE public.orders ADD COLUMN bike_value numeric NULL;
```

**2. `src/types/order.ts`**
- Add `value?: string` to bikes array items in `CreateOrderFormData`
- Add `partExchangeBikeValue?: string` to `CreateOrderFormData`
- Add `bikeValue?: number` and `bikes?: Array<{brand: string; model: string; type: string; value?: string}>` to `Order` type

**3. `src/pages/CreateOrder.tsx`**
- Add `value: z.string().optional()` to bikes array schema
- Add `partExchangeBikeValue: z.string().optional()` to root schema
- Add default `value: ""` to bikes defaults and `partExchangeBikeValue: ""` to form defaults

**4. `src/components/create-order/OrderDetails.tsx`**
- Change bike grid from 3-col to 4-col (`md:grid-cols-4`)
- Add a "Value (£)" input field per bike (optional, numeric placeholder "e.g. 2000")

**5. `src/components/create-order/OrderOptions.tsx`**
- Add a "Part Exchange Bike Value (£)" input field after the type selector in the bike swap section
- Clear it when `isBikeSwap` is toggled off

**6. `src/services/orderService.ts`**
- Destructure `partExchangeBikeValue` from data
- Pass `bike_value` (from first bike's value, parsed as number) in the main order insert
- Pass `bike_value` (from `partExchangeBikeValue`) in the reverse/part-exchange order insert

**7. `src/services/orderServiceUtils.ts`**
- Map `dbOrder.bike_value` → `bikeValue` and `dbOrder.bikes` → `bikes` on the Order object

**8. `src/components/order-detail/ItemDetails.tsx`**
- Show bike type: `<p><span className="font-medium">Type:</span> {order.bikeType}</p>`
- Show bike value if present: `<p><span className="font-medium">Value:</span> £{order.bikeValue}</p>`
- For multi-bike orders, iterate `order.bikes` to show type and value per bike

**9. `src/pages/CustomerOrderDetail.tsx`**
- Add bike type and value display in the inline Item Details section, mirroring the above

