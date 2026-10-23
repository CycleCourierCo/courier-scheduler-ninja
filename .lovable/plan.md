# Mark website (Shopify) orders as fulfilled with a tracking link

## What changes
When a paid order arrives from cyclecourierco.com and the booking is created here, the Shopify order is immediately marked **Fulfilled**, with:
- Tracking number: our CCC tracking number
- Tracking link: `https://cyclecourierco.com/pages/track?ref=<tracking number>`
- Carrier name: "Cycle Courier Co."
- Shopify's own "your order is on its way" email to the customer: off (they already get our emails) — say if you want it on.

If the order already exists here (Shopify resends the webhook), it is fulfilled only if it isn't already. If Shopify refuses, the booking is still created and the reason is logged.

## What I need from you
A Shopify Admin access token for the main store with `write_merchant_managed_fulfillment_orders` and `read_orders` permissions (Shopify admin → Apps → Develop apps). I'll ask for it securely when building, plus the store's `.myshopify.com` address.

## Technical notes
- `supabase/functions/shopify-webhook/index.ts`: after the Orders API returns the tracking number, reuse the fulfilment pattern from `customer-shopify-webhook` (GET `fulfillment_orders.json`, POST `fulfillments.json` with `tracking_info` {number, url, company}, `notify_customer: false`), skipping fulfilment orders already closed. Same on the duplicate-order path.
- New secrets: `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`. Calls go through `trackedFetch` for integration logging.
- Small test for the tracking-URL builder. Deploy `shopify-webhook`.
