# Non-stored SKUs for Shopify B2B customers

Today the Shopify webhook only matches a sold line item against bikes physically stored with us (`warehouse_stock.sku`). Anything else is logged as "unmatched SKU" and nothing happens. B2B customers also sell bikes they keep themselves, so those sales should auto-book a collection from them.

## What the customer sees

New "My SKUs (not stored with us)" card on the Shopify Integration page:
- Add a SKU with bike brand, model, type and value.
- List of existing SKUs with edit and delete.
- Short note explaining that a sale on one of these SKUs books a collection from their own address, not from our warehouse.

Existing behaviour is unchanged: stored stock still matches first.

## What happens on a sale

Webhook match order per line item:
1. Stored stock with that SKU (FIFO) → current warehouse dispatch flow.
2. Otherwise a registered non-stored SKU → create an order with the customer's own profile address as the **collection** address and the Shopify buyer as the receiver, using the SKU's bike brand/model/type/value. Order starts in the normal new-order state so availability/scheduling emails run as usual.
3. Otherwise → unchanged "unmatched SKU" log.

Activity log gets a distinct status for these so the customer can tell warehouse dispatch from own-stock collections. Tracking generation and the Shopify fulfilment push work the same way as for stored stock.

## Technical notes

- New table `customer_shopify_skus`: `id`, `user_id`, `store_id` (nullable), `sku` (unique per user, case-insensitive), `bike_brand`, `bike_model`, `bike_type`, `bike_value`, `is_active`, timestamps. GRANTs for `authenticated`/`service_role`, RLS: owner full access, admins read/manage, service role for the webhook.
- `supabase/functions/customer-shopify-webhook/index.ts`: after the `warehouse_stock` lookup misses, look up `customer_shopify_skus`; on a hit build the order with sender = customer profile address and log status `matched_customer_stock`; keep the existing dedupe key and the fulfilment/tracking block shared between both paths.
- `src/pages/ShopifyIntegrationPage.tsx`: new SKU manager card (table + add/edit dialog) reading and writing `customer_shopify_skus` directly via the Supabase client; badge handling in `statusBadge` for the new status.
- Setup instructions on the page updated to mention both SKU sources.
