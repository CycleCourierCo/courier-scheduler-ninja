

## Auto-Create Return Order on Button Click

### What it does
Instead of navigating to the Create Order form, the "Return" button directly creates a new order with sender/receiver swapped and the same bike details. The user sees a confirmation toast and can click through to the new order.

### Why this is straightforward
The existing `createOrder` service already handles everything end-to-end: auth check, tracking number generation, contact upserts, Shipday job creation, and confirmation emails. The current order already contains all required data — we just swap sender↔receiver and copy bike fields.

### Changes

| File | Change |
|---|---|
| `src/pages/CustomerOrderDetail.tsx` | Add "Return" button with `RotateCcw` icon. On click, call `createOrder()` with swapped sender/receiver and same bike details. Show loading state during creation. On success, toast with link to new order. On error, toast error message. |
| `src/pages/OrderDetail.tsx` | Same "Return" button for admin view. |

### Technical detail

The button handler builds a `CreateOrderFormData` object from the current order:
- `sender` ← current `order.receiver` (name, email, phone, address)
- `receiver` ← current `order.sender` (name, email, phone, address)
- `bikes`, `bikeBrand`, `bikeModel`, `bikeType`, `bikeQuantity` ← copied as-is
- `customerOrderNumber` ← original + `-RETURN` suffix
- All other flags (`needsInspection`, `isBikeSwap`, `needsPaymentOnCollection`, `isEbayOrder`) default to `false`

Uses a loading state on the button to prevent double-clicks. On success, shows a toast with "Return order created" and a link to `/order/{newOrderId}`.

