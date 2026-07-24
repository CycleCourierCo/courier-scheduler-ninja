## Box My Bike – add "Delivered by 3rd-party courier" stage + tracking-link nudge

### 1. New stage: `delivered_by_3p`

Extend the Box My Bike workflow with a sixth and final stage after `collected_by_3p`.

**Database (single migration):**
- `ALTER TYPE public.order_status ADD VALUE 'delivered_by_3p'` (after `collected_by_3p`). The `box_my_bike_status` column is plain `text`, so no enum change needed there.
- Add column `orders.box_delivered_by_3p_at timestamptz`.
- Extend `get_webhook_event_for_status(...)` to map `delivered_by_3p` → `order.box.delivered_by_3p`.

**Types & labels (`src/types/order.ts`):**
- Add `'delivered_by_3p'` to both the box status union and `BOX_MY_BIKE_STATUS_ORDER`.
- Label: "Delivered by 3rd-party courier".
- Add the same value to the mirrored `order_status` union used in `orderService*`.

**Page (`src/pages/BoxMyBikePage.tsx`):**
- `stageTimestampColumn`: `delivered_by_3p → 'box_delivered_by_3p_at'`.
- `stageWebhookEvent`: `delivered_by_3p → 'order.box.delivered_by_3p'`.
- The Advance button already walks through `BOX_MY_BIKE_STATUS_ORDER`, so appending the new stage automatically enables advancing from `collected_by_3p` → `delivered_by_3p`. Staff tab list also picks it up automatically.

**Public tracking timeline (`src/components/order-detail/TrackingTimeline.tsx` and `public._build_public_order_payload`):**
- Surface a "Delivered by 3rd-party courier" milestone driven by `box_delivered_by_3p_at`, mirroring the existing box milestones.

**Peripheral references (kept in sync but no behaviour change):**
- `src/components/StatusBadge.tsx` — add label/colour for the new status.
- `src/components/webhooks/CreateWebhookDialog.tsx`, `docs/WEBHOOK_DOCUMENTATION.md`, `src/pages/ApiDocumentationPage.tsx` — list the new `order.box.delivered_by_3p` event.
- `supabase/functions/trigger-webhook/index.ts` and `supabase/functions/orders/index.ts` — allow the new event/status through.

### 2. Tracking-link nudge for the customer (not the Advance button)

Drop the Advance-button tooltip work. Instead, focus the reminder on the customer at the point they upload the label, so they add the tracking link at the same time.

In `src/pages/BoxMyBikePage.tsx` / `TrackingUrlEditor`:
- When `stage === 'boxed_awaiting_label'` and `box_tracking_url` is empty, show a clearly-visible required prompt above the URL input for the owner/staff: "Please paste the courier tracking link here — this must be added along with the label so your recipient can track the parcel."
- Mark the input as required (asterisk on the "3rd-party tracking link" heading, subtle red border on the empty field).
- No change to the Advance-button gating logic.

### Files touched
- Migration (new).
- `src/types/order.ts`
- `src/pages/BoxMyBikePage.tsx`
- `src/components/order-detail/TrackingTimeline.tsx`
- `src/components/StatusBadge.tsx`
- `src/components/webhooks/CreateWebhookDialog.tsx`
- `src/services/orderService.ts`, `src/services/orderServiceUtils.ts` (union type only)
- `supabase/functions/trigger-webhook/index.ts`
- `supabase/functions/orders/index.ts`
- `docs/WEBHOOK_DOCUMENTATION.md`, `src/pages/ApiDocumentationPage.tsx`
