# Reject all repairs and return the bike to the seller

Give the account holder a single button on the bicycle inspection screen that turns down every recommended repair and sends the bike straight back to the seller, instead of them having to decline each item one at a time.

## What the account holder sees

On their inspection, alongside the existing per-item Accept / Decline buttons, a new destructive button:

**"Decline all repairs and return to seller"**

It only appears for the account holder on their own inspection, while there are still repair items awaiting their answer.

Clicking it opens a short confirmation explaining exactly what will happen:

- Every recommended repair is declined.
- The current delivery job is cancelled.
- A new return job is created, taking the bike back to the original seller.
- The bike stays where it is in the warehouse, so the team can find it for the return.

After confirming, they get a success message with a link to the new return job.

## What happens behind the scenes

1. All outstanding repair items on that inspection are marked declined, with the reason recorded as "Declined — returning to seller", and the inspection moves to its ship-as-is state so no workshop work is booked.
2. A return job is created for the same account, with the original receiver as the new sender and the original sender as the new receiver, same bike details, order reference suffixed `-RETURN`, no inspection and no payment on collection.
3. The return job is marked as already collected (we already hold the bike), and its warehouse bay allocation is copied from the original job so it shows in the same place on the loading and storage screens.
4. The original job is cancelled and its courier jobs (collection and delivery) are deleted from Shipday, with the cancellation marker set so nothing re-creates them. Its bay allocation is cleared so the bike isn't counted twice.
5. Our team is notified by email that the customer chose to return the bike, so someone can plan the return leg.

If the courier jobs can't be deleted, the return is still created and the original is still cancelled, and the failure is reported back so the team can clear it manually.

## Technical detail

- New edge function `reject-repairs-return-to-seller` (`verify_jwt = false`, JWT validated in code):
  - Validates the caller's bearer token, loads the order, and allows only the owning account (`orders.user_id`) or internal staff (admin / customer_service / mechanic).
  - Declines all `inspection_issues` for the order that are `pending` (and any offered-but-unanswered), stamping `customer_response` / `customer_responded_at`; sets `bicycle_inspections.status = 'ship_as_is'`.
  - Generates the return tracking number by invoking the existing `generate-tracking-numbers` function (`generateSingle`), mirroring website order creation.
  - Inserts the return order with service role: swapped `sender` / `receiver` JSONB snapshots and flat address fields, copied `bikes` / `bike_quantity` / bike brand-model-type, `user_id` from the original, `status = 'collected'`, `order_collected = true`, `storage_locations` copied from the original, `needs_inspection = false`, `needs_payment_on_collection = false`, and a `notes`/reference link back to the original tracking number.
  - Reuses the Shipday teardown logic already in `cancel-order` (delete every known pickup/delivery id from flat columns, tracking block and webhook history, null the ids, stamp the cancellation marker), sets the original order to `cancelled` and clears its `storage_locations`.
  - Sends the internal notification via the existing Resend sender, wrapped in `EdgeRuntime.waitUntil`.
  - Returns `{ success, returnOrderId, returnTrackingNumber, shipdayCleared, failedLegs }`.
- Migration: index/no schema change expected; add a `returned_to_seller_at` timestamp on `orders` (original) plus `returned_from_order_id` on the return order so the two jobs are linked and the action is auditable.
- Frontend:
  - `src/services/inspectionService.ts`: `rejectRepairsAndReturnToSeller(orderId)` wrapper invoking the function.
  - `src/pages/BicycleInspections.tsx`: new button + confirmation dialog in the customer (`!isAdmin && isOwner`) issue area, shown once per inspection rather than per item, with mutation, toast + link to the return job, and query invalidation.
  - Order detail shows the "Returned to seller" link on both jobs.
