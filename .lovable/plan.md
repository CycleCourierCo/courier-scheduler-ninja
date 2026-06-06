## Problem

The new Box My Bike webhook events were added to `docs/WEBHOOK_DOCUMENTATION.md` and `CreateWebhookDialog.tsx`, but the in-app **API Documentation page** (`src/pages/ApiDocumentationPage.tsx`) still shows only the original 7 events. That's the page the user actually sees, hence "I can't see the documentation".

## Change

Update `src/pages/ApiDocumentationPage.tsx` in the Webhooks → Available Events section to add 5 new entries:

- `order.box.status.updated` — Box My Bike status changed (generic)
- `order.box.in_depot` — Bike arrived at depot, awaiting boxing
- `order.box.boxed` — Bike boxed, awaiting shipping label
- `order.box.label_uploaded` — 3rd-party shipping label uploaded
- `order.box.collected_by_3p` — Boxed bike collected by 3rd-party courier

Also add a small "Box My Bike payload example" block under the existing Webhook Payload Example showing the extra `data` fields (`is_box_my_bike`, `box_my_bike_status`, `box_label_url`, `box_in_depot_at`, `box_boxed_at`, `box_label_printed_at`, `box_collected_by_3p_at`).

No other files change. No backend or logic changes.
