# Backfill: mark the last 10 Shopify orders as fulfilled

These 10 website orders (Shopify #2404 to #2413, placed 22–23 Oct) came in before auto-fulfilment was switched on. Each one will be marked Fulfilled in Shopify with its CCC tracking number and the cyclecourierco.com tracking link. Shopify's shipping email stays off, the same as for new orders.

| Shopify # | Tracking |
|---|---|
| 2413 | CCC754705283732JAMSO1 |
| 2412 | CCC754935895690JAMSA6 |
| 2411 | CCC754886478126PHISW1 |
| 2410 | CCC754647212816CHARG7 |
| 2409 | CCC754119860292CHAOX7 |
| 2408 | CCC754103590921WILNG8 |
| 2407 | CCC754908074568FIONE3 |
| 2406 | CCC754638540934SEABS1 |
| 2405 | CCC754518484720JOSBH2 |
| 2404 | CCC754209153248ANDDY8 |

Orders that are already fulfilled in Shopify are left alone. You'll get a per-order result (fulfilled / already fulfilled / failed and why). This also serves as the first real test of the Shopify keys.

## Technical notes
- Add a staff-only `backfill` action to `shopify-webhook`. It is checked against the service-role key, takes a list of Shopify order IDs and tracking numbers, and calls the existing `fulfilShopifyOrder` for each one.
- Deploy the function, invoke it once with the 10 pairs above, and report the results. The action stays in place for future one-off fixes.
