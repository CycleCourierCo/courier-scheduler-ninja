# Non-stored SKUs for Shopify B2B customers

Today the Shopify webhook only matches a sold line item against bikes physically stored with us (`warehouse_stock.sku`). Anything else is logged as "unmatched SKU" and nothing happens. B2B customers also sell bikes they keep themselves, so those sales should auto-book a collection from them.

## What the customer sees

New "My SKUs (not stored with us)" card on the Shopify Integration page:
- Add a SKU and pick a bike type from a dropdown — that's the only detail needed.
- List of SKUs with edit and delete.
- **Bulk upload**: paste or upload a CSV of `sku,bike_type` to add many SKUs at once, with a downloadable template, a preview of valid/invalid rows before import, and an "Import from Shopify" option that pulls every product variant SKU from the connected store so the customer only has to set bike types. Existing SKUs are updated rather than duplicated.
- Note explaining brand, model and value are read from the Shopify order itself, and that a sale on one of these SKUs books a collection from their own address rather than our warehouse.


Existing behaviour is unchanged: stored stock still matches first.

## Where the bike details come from

- **Brand and model**: from the Shopify line item title. First word (or the Shopify vendor when present, which is more reliable) becomes the brand, the remainder becomes the model. Variant title is appended to the model when it adds detail.
- **Value**: the line item price times quantity (falls back to the order total when the line price is missing).
- **Bike type**: from the SKU record the customer registered, since Shopify has no reliable field for it. This drives pricing and van-space weighting, so it stays an explicit choice.

## What happens on a sale

Webhook match order per line item:
1. Stored stock with that SKU (FIFO) → current warehouse dispatch flow.
2. Otherwise a registered non-stored SKU → create an order with the customer's own profile address as the **collection** address and the Shopify buyer as the receiver, bike details derived as above. Order starts in the normal new-order state so availability/scheduling emails run as usual.
3. Otherwise → unchanged "unmatched SKU" log.

Activity log gets a distinct status so the customer can tell warehouse dispatch from own-stock collections. Tracking generation and the Shopify fulfilment push work the same way as for stored stock.

## Technical notes

- New table `customer_shopify_skus`: `id`, `user_id`, `store_id` (nullable), `sku` (unique per user, case-insensitive), `bike_type`, `is_active`, timestamps. GRANTs for `authenticated`/`service_role`; RLS: owner full access, admins manage, service role for the webhook.
- `supabase/functions/customer-shopify-webhook/index.ts`: after the `warehouse_stock` miss, look up `customer_shopify_skus`; on a hit derive brand/model from `item.vendor`/`item.title`/`item.variant_title` and value from `item.price * item.quantity`, build the order with sender = customer profile address, and log status `matched_customer_stock`. Keep the existing dedupe key and share the tracking/fulfilment block between both paths.
- `src/pages/ShopifyIntegrationPage.tsx`: SKU manager card (list + add/edit dialog) reading and writing `customer_shopify_skus` via the Supabase client; bike-type dropdown sourced from the same bike-type list used in order creation; badge handling for the new log status.
- Setup instructions on the page updated to mention both SKU sources.
