

## Fix: Add Emails, Tracking & Shipday to Stock Delivery Requests

### Problem
`requestDeliveryFromStock` in `warehouseStockService.ts` does a raw `orders` insert but skips the post-creation steps that `createOrder` in `orderService.ts` performs:
1. No tracking number generated
2. No confirmation email to the order creator
3. No receiver notification/availability email
4. No sender availability email
5. No Shipday delivery job created

### Solution
Update `requestDeliveryFromStock` to call the same post-creation hooks after inserting the order:

**File: `src/services/warehouseStockService.ts`**

After the order is created and stock is marked as reserved, add:

1. **Generate tracking number** -- call `generateTrackingNumber()` from `trackingService` using the depot name and receiver postcode, then update the order with it
2. **Send emails** -- call the same three email functions used in `createOrder`:
   - `sendOrderCreationConfirmationToUser` (confirmation to the customer who booked)
   - `sendOrderNotificationToReceiver` (delivery notification to the receiver)
   - `sendReceiverAvailabilityEmail` (receiver availability link) -- note: for warehouse dispatches, the sender is the depot so sender availability is not needed; only receiver availability matters
3. **Create Shipday delivery job** -- call `createShipdayOrder(orderId, 'delivery')` since pickup is from the depot (no collection needed)

All three steps run in fire-and-forget style (same pattern as `createOrder`) so the UI remains responsive.

### Key difference from normal orders
- **No sender availability email** -- the stock is already at the depot, no collection needed
- **Shipday: delivery only** -- pass `jobType: 'delivery'` since there's no pickup leg

### Technical Details

```
Import additions:
  - generateTrackingNumber from trackingService
  - sendOrderCreationConfirmationToUser, sendOrderNotificationToReceiver, sendReceiverAvailabilityEmail from emailService
  - createShipdayOrder from shipdayService

After order insert + stock update:
  1. const trackingNumber = await generateTrackingNumber(senderName, receiverZipCode)
  2. Update order with tracking_number
  3. Fire-and-forget: send emails (confirmation + receiver notification + receiver availability)
  4. Fire-and-forget: createShipdayOrder(order.id, 'delivery')
```

Single file change, no database changes needed.

