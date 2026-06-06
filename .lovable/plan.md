## Add Box My Bike webhook events

Extend the existing webhook system to notify subscribers when an order's Box My Bike status changes.

### New events

Add to `AVAILABLE_EVENTS` and supported event list:
- `order.box.status.updated` — fires on every `box_my_bike_status` change (generic)
- `order.box.in_depot` — fires when status → `in_depot_awaiting_boxing`
- `order.box.boxed` — fires when status → `boxed_awaiting_label`
- `order.box.label_uploaded` — fires when status → `awaiting_3p_collection` (label PDF attached)
- `order.box.collected_by_3p` — fires when status → `collected_by_3p`

### Payload

Extend `trigger-webhook` event payload `data` block with Box My Bike fields when present:
- `is_box_my_bike`, `box_my_bike_status`, `box_label_url`
- `box_in_depot_at`, `box_boxed_at`, `box_label_printed_at`, `box_collected_by_3p_at`
- For `order.box.status.updated`: include `previous_status` and `new_status`

### Wiring

Find every code path that mutates `box_my_bike_status` (or the related timestamp/label columns) and call `trigger-webhook` after the update succeeds. Candidates to audit and wire:
- `src/pages/BoxMyBikePage.tsx` (admin status transitions, label upload)
- Any service helpers used by that page
- `supabase/functions/create-box-my-bike-invoice` (only if it changes status)

Each mutation site fires:
1. The matching specific event (e.g. `order.box.boxed`)
2. The generic `order.box.status.updated`

### UI

`src/components/webhooks/CreateWebhookDialog.tsx` — add the 5 new events to `AVAILABLE_EVENTS` so customers can subscribe.

### Docs

Update `docs/WEBHOOK_DOCUMENTATION.md` with the new events, sample payloads, and trigger conditions.

### Out of scope

- No new DB columns; existing `box_my_bike_status` and timestamp fields are sufficient.
- No changes to webhook signature, retry, or logging logic.
