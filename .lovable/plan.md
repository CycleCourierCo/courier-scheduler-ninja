## Goal
On the public tracking page, show Box My Bike lifecycle milestones in the tracking timeline so customers can see where their bike is in the boxing workflow.

## Milestones to show (only when the order is a Box My Bike order)

Rendered as timeline events using the timestamps stored on the order:

| Timeline title | Timestamp field | Description |
| --- | --- | --- |
| In depot, awaiting boxing | `box_in_depot_at` | Bike has arrived at the depot and is queued for boxing |
| Boxed, awaiting label | `box_boxed_at` | Bike has been boxed and is awaiting a shipping label |
| Awaiting 3rd-party collection | `box_label_printed_at` | Label printed — awaiting 3rd-party courier collection |
| Collected by 3rd-party courier | `box_collected_by_3p_at` | Bike has been handed to the 3rd-party courier |

Each event only renders when its timestamp is set. They chronologically slot into the existing timeline (sorted by date, alongside "Bike Collected", inspection events, etc.). Use a `Package`/`Box`-style icon from `lucide-react` (e.g. `Package` for depot, `Box` for boxed, `Truck` for the 3P steps) to visually differentiate them.

## Technical changes

1. **`supabase/migrations/<new>.sql` — extend `_build_public_order_payload`**
   Add the following keys to the returned JSON so the public tracking RPC exposes them:
   - `is_box_my_bike`
   - `box_my_bike_status`
   - `box_in_depot_at`
   - `box_boxed_at`
   - `box_label_printed_at`
   - `box_collected_by_3p_at`
   
   `get_public_order` and `get_public_order_with_proof` both delegate to this helper, so no other RPC changes needed.

2. **`src/services/orderServiceUtils.ts`** — already maps all six fields (`isBoxMyBike`, `boxMyBikeStatus`, `boxInDepotAt`, `boxBoxedAt`, `boxLabelPrintedAt`, `boxCollectedBy3pAt`). No change required.

3. **`src/components/order-detail/TrackingTimeline.tsx` — `getTrackingEvents`**
   After the inspection lifecycle block, add a Box My Bike block: when `order.isBoxMyBike` is true, push one event per non-null timestamp above with the mapped title/description/icon. Sorting into the timeline uses the existing date-sort logic (no change).

No changes to the mechanic/admin Box My Bike workflow, RLS, or other tabs.
