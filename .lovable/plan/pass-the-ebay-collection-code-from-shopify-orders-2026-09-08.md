# Pass the eBay collection code from Shopify orders

## What's wrong

Shopify order #2114 (tracking `CCC754968576905MARBL0`) shows "eBay Collection Code: 587974" on the line item, but in this system the order was saved with no collection code and not marked as an eBay order.

Confirmed by checking the stored order: `collection_code` is empty and the eBay flag is off.

Cause: the Shopify order handler reads bike brand, model, value, and both sets of contact/address details from the line-item fields, but never reads the eBay collection code field, so it is never sent on when the order is created. The order creation API already accepts a collection code — nothing is being given to it.

## The fix

1. Read the eBay collection code from the Shopify line item, accepting the common label variants ("eBay Collection Code", "Ebay Collection Code", "Collection Code").
2. When a code is present, send it through with the new order and mark the order as an eBay order. When absent, behaviour is unchanged.
3. Log whether a code was found (the code itself is not sensitive customer data, but keep logging minimal).
4. Backfill order #2114 so it shows collection code 587974 and is flagged as an eBay order.

## Technical detail

- `supabase/functions/shopify-webhook/index.ts`: add a `collectionCode` lookup via the existing `getPropertyValue` helper against the transport line item's `properties`, then include `collectionCode` and `isEbayOrder: !!collectionCode` in the body posted to the `orders` function.
- `supabase/functions/orders/index.ts` already maps `body.collectionCode` → `collection_code` and `body.isEbayOrder` → `is_ebay_order`; no change needed there.
- Backfill: single update on `orders` for tracking number `CCC754968576905MARBL0` setting `collection_code = '587974'` and `is_ebay_order = true`.
- Verification: typecheck, then re-query the order to confirm the values landed. Future Shopify orders carrying the field will populate automatically once the function is deployed.
