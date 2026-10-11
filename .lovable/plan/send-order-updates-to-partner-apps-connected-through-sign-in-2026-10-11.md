# Send order updates to partner apps connected through sign-in (OAuth)

## Why CCC754507545377MICB13 got no webhook
- Broximo connected VeloDealer through the partner sign-in on 1 Oct 2026 (12:54). The connection is active, and VeloDealer booked this order with it 2 minutes earlier in the same session.
- But a sign-in connection only lets VeloDealer **book and read** orders. It doesn't sign them up for update messages. Update messages are only sent to webhooks set up on the customer's account.
- Broximo's only webhook is the old "VDMS - BROXIMO" one. It has been switched off since 19 Sep 2026, so nothing was sent. (When it was on, VeloDealer often replied "Collection not found".)

So the gap is in our system: connecting through sign-in should also send order updates to the partner app.

## What changes
1. **One webhook address per partner app.** On the Partner Apps page, admins can set a webhook address and the events to send for each app (for example VeloDealer), with a signing secret shown once.
2. **Updates go to every connected customer automatically.** When an order changes, we send the update to each partner app the order's customer has an active sign-in connection with. Revoked connections stop receiving updates straight away.
3. **No double sending.** If a customer also has their own webhook pointing at the same address, it's only sent once.
4. **Delivery log.** Partner-app sends appear in the same delivery history, with retries and response codes, so we can see what VeloDealer replied.
5. **Catch-up.** Once VeloDealer's address is set, resend the current status for Broximo's orders booked through the connection (including this one). I'll list them before sending anything.
6. Update the partner integration guide to explain that connected apps receive updates automatically.

## What I need from you
- VeloDealer's webhook address for sign-in partners. It may differ from the old VDMS address, which kept replying "Collection not found".

## Technical details
- Migration: add `webhook_url`, `webhook_events text[]`, `webhook_secret_hash`, `webhook_secret_prefix` to `oauth_clients`; add nullable `oauth_client_id` to `webhook_delivery_logs` (`webhook_config_id` made nullable). Admin-only RPC to set the URL and generate a secret, following the pattern of `admin_generate_webhook_secret`.
- `trigger-webhook/index.ts`: after loading `webhook_configurations`, also load `oauth_access_grants` (`revoked_at is null`) for `order.user_id`, join active `oauth_clients` that have a `webhook_url` and the event subscribed, dedupe by endpoint URL, and send with the same signing, payload and retry code.
- `PartnerAppsPage.tsx`: webhook URL, event picker, "generate secret" dialog.
- `docs/PARTNER_API_INTEGRATION.md` updated.
