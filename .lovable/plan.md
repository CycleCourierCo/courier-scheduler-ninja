## Goal
When a Box My Bike order is at "Boxed, awaiting label", staff can enter a 3rd-party tracking URL alongside the label upload. The tracking URL is then shown as a clickable button on the customer's tracking page.

## Changes

### 1. Database
Migration adds a nullable `box_tracking_url TEXT` column on `public.orders`. Also update `public._build_public_order_payload` to include `box_tracking_url` so public tracking (`get_public_order` / with-proof) surfaces it. No policy/grant changes needed — column inherits from existing table policies.

### 2. Admin UI — `src/pages/BoxMyBikePage.tsx`
In the "Shipping label" card (visible for stage `boxed_awaiting_label` or when a label exists), add a "3rd-party tracking link" row:
- Text input (URL) pre-filled with current value.
- "Save" button that updates `box_tracking_url` on the order and fires an `order.box.tracking_url_set` webhook.
- Keep the label upload block untouched.
- Both `isOwner` (customer of the box order) and staff can save. Match the same permission gate already used for label upload.
- Add `box_tracking_url` to the select list and `BoxOrder` type.

### 3. Order mapping — `src/services/orderServiceUtils.ts` + `src/types/order.ts`
Add `boxTrackingUrl: string | null` to the mapped order shape and the `Order` type so it flows through both authenticated and public paths.

### 4. Customer tracking — `src/components/order-detail/TrackingTimeline.tsx`
In the Box My Bike lifecycle block (~line 386), if `order.boxTrackingUrl` is present, render a "Track with courier" event entry that opens the URL in a new tab (target="_blank", rel="noopener noreferrer"). Anchor it to `boxLabelPrintedAt` when available, otherwise `boxBoxedAt`, so it sits at the "Awaiting 3rd-party collection" step in the timeline.

### 5. Webhook payload — `supabase/functions/trigger-webhook/index.ts`
Include `order.box_tracking_url` in the box event payload next to `box_label_url`, and add a new event constant `order.box.tracking_url_set` to the enum/mapping list where box events are declared.

## Out of scope
- No URL validation beyond `<input type="url">`.
- No history log of tracking URL changes.
- No auto-detection of courier from URL — plain link only.