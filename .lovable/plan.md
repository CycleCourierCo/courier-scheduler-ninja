# Fix "Collection scheduled" badge in the multi-job selector

## What's wrong

In the Choose Jobs To Load dialog, a delivery shows "Collection scheduled <date>" even when no collection has actually been booked. The status check falls back to the customer's chosen availability dates when there is no booked collection date, and treats the first available day as if it were a booked one.

## The fix

Only show "Collection scheduled" when a real booked collection date exists. When the customer has merely submitted their available days, the badge shows "Not collected".

Everything else stays the same: already-collected bikes show "Collected", collections on the same route show the earlier/later-on-route badges.

## Technical detail

In `src/utils/csvRouteParser.ts`, `getDeliveryCollectionStatus` currently returns `{ kind: 'scheduled' }` from `order.pickup_date[0]` (the availability array) when `scheduled_pickup_date` is absent. Remove that availability fallback so the function returns `{ kind: 'not_collected' }`; keep the `scheduled_pickup_date` branch. No change needed in `CSVMatchReviewDialog.tsx`.
