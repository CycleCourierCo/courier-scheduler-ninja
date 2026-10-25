# Mark website (Shopify) orders as fulfilled with a tracking link

## What changes
When a paid order arrives from cyclecourierco.com and the booking is created here, the Shopify order is immediately marked **Fulfilled**, with:
- Tracking number: our CCC tracking number
- Tracking link: `https://cyclecourierco.com/pages/track?ref=<tracking number>`
- Carrier name: "Cycle Courier Co."
- Shopify's own "your order is on its way" email to the customer: off (they already get our emails) — say if you want it on.

If the order already exists here (Shopify resends the webhook), it is fulfilled only if it isn't already. If Shopify refuses, the booking is still created and the reason is logged.

## What I need from you
The webhook only lets Shopify tell us about orders; it can't be used to change an order back in Shopify. For that we need a key for your own store. This does not need a developer account or Shopify review — it's a private app only your store uses:

1. Shopify admin → Settings → Apps and sales channels → Develop apps (turn on "Allow custom app development" if asked).
2. Create an app called "Cycle Courier booking", set permissions `read_orders`, `write_merchant_managed_fulfillment_orders`, `write_assigned_fulfillment_orders`, then Install.
3. Copy the Admin API access token (starts `shpat_`). I'll give you a secure box to paste it in, plus your `.myshopify.com` address.

## Technical notes
- `supabase/functions/shopify-webhook/index.ts`: after the Orders API returns the tracking number, reuse the fulfilment pattern from `customer-shopify-webhook` (GET `fulfillment_orders.json`, POST `fulfillments.json` with `tracking_info` {number, url, company}, `notify_customer: false`), skipping fulfilment orders already closed. Same on the duplicate-order path.
- New secrets: `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`. Calls go through `trackedFetch` for integration logging.
- Small test for the tracking-URL builder. Deploy `shopify-webhook`.
