## Goal
Let admins edit each bike's brand and model on the Order Details page.

## Changes

**1. `src/components/order-detail/ItemDetails.tsx`**
- For admins, add an "Edit Bikes" button next to the item list.
- Clicking opens a dialog listing each bike row (based on `order.bikes` JSONB, source of truth) with editable Brand and Model text inputs. Type/value stay read-only (out of scope).
- Save writes back the updated `bikes` array to `orders.bikes` via a small service call, and also refreshes the legacy flat `bike_brand`/`bike_model` fields from the first bike so existing UI (labels, item name) stays consistent.
- On success, toast + call existing `onRefresh()`.

**2. `src/services/orderService.ts`**
- Add `updateOrderBikes(orderId, bikes)` that updates `orders.bikes`, `bike_brand`, `bike_model` in one call.

## Out of scope
Bike type, value, quantity, add/remove rows — brand & model only, as requested.
