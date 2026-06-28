# Plan: Customer Shopify → Warehouse Auto-Dispatch

Each B2B customer connects their own Shopify store. When one of their products sells, we match the line item's SKU to a bike they have stored in our warehouse and auto-create a delivery order from the depot to the buyer. Tracking and fulfilment are pushed back to Shopify.

## How it works (end-user flow)

```text
Customer's Shopify         Our Platform                    Warehouse
─────────────────         ────────────────                ──────────
1. Buyer pays  ────────►  2. orders/paid webhook
                          3. Look up store by shop domain
                          4. For each line item:
                             - Find warehouse_stock by
                               (customer_user_id, sku, status='stored')
                             - Reserve it + create order
                                                            │
                          5. Generate tracking #            │
                          6. Push fulfilment + tracking ──► Shopify
                             back to customer's Shopify
                                                            │
                          7. Driver dispatches  ◄───────────┘
                          8. On delivered → mark fulfilled
                             in Shopify
```

## What gets built

### 1. Customer-facing connection UI
New page **Settings → Shopify Integration** (visible to `b2b_customer` only):
- Input fields: Shop domain (`myshop.myshopify.com`), Admin API access token, Webhook signing secret.
- Step-by-step instructions for creating a Custom App in their Shopify admin with the required scopes (`read_orders`, `write_fulfillments`, `read_products`).
- "Test connection" button that calls Shopify `/admin/api/2024-10/shop.json` to verify the token.
- Display the webhook URL they need to paste into Shopify: `https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/customer-shopify-webhook?store=<id>`.

### 2. New table `customer_shopify_stores`
Stores per-customer Shopify credentials. Access token stored in Supabase Vault (not plaintext column). RLS: customer can only see/edit their own row; admins see all.

Columns: `id`, `user_id`, `shop_domain`, `access_token_vault_key`, `webhook_secret_vault_key`, `is_active`, `last_synced_at`, `created_at`, `updated_at`.

### 3. Add `sku` to `warehouse_stock`
New nullable `sku text` column + index on `(user_id, sku, status)`. The existing warehouse stock UI (`WarehouseStockPage.tsx`, intake form in `warehouseStockService.ts`) gets a SKU field so the loader/admin records the SKU when depositing a bike.

### 4. New edge function `customer-shopify-webhook`
Receives `orders/paid` from any connected customer store.
- Identifies the store via shop domain header + verifies HMAC against that store's webhook secret.
- For each line item with a SKU:
  - Query `warehouse_stock WHERE user_id = store.user_id AND sku = lineItem.sku AND status = 'stored' LIMIT 1`.
  - If found: call existing `requestDeliveryFromStock` logic (already in `warehouseStockService.ts`) using buyer's Shopify shipping address as the receiver. This already handles reservation, tracking number, emails, and Shipday job creation.
  - If not found: write a row to a new `customer_shopify_order_log` table with status `unmatched_sku` so the customer can see what failed in their dashboard.
- Background task (`EdgeRuntime.waitUntil`) pushes fulfilment back to Shopify with the generated tracking number.

### 5. New edge function `shopify-push-fulfilment`
Called when an order's status transitions to `delivered` (triggered from the existing `trigger_order_webhook` pathway or a new DB trigger). Calls Shopify `POST /admin/api/2024-10/fulfillments.json` on the customer's store with the tracking number, marking the Shopify order as shipped so the buyer gets Shopify's native shipping notification.

### 6. Customer dashboard widget
On the existing `MyStockPage.tsx`, add a "Shopify Activity" section showing recent webhook events: matched orders, unmatched SKUs (with the SKU and Shopify order #), and any push-fulfilment failures.

## Edge cases handled

- **No SKU on warehouse item** — webhook logs as `unmatched_sku`, customer is alerted.
- **Multiple stock items with same SKU** — pick oldest `deposited_at` (FIFO).
- **Buyer address invalid / no postcode** — order still created but flagged for admin review, no auto-dispatch.
- **Webhook replay / duplicate** — dedupe on `(shop_domain, shopify_order_id)` in the log table.
- **Customer disables integration** — `is_active=false` short-circuits webhook to a 200 OK no-op.
- **Token revoked in Shopify** — push-fulfilment retries with exponential backoff, then surfaces as a dashboard alert.

## Out of scope (per your answers)

- No inventory count sync to Shopify (you chose fulfilment + tracking only). Customers manage their Shopify stock manually; we only signal "this one shipped".
- No public Shopify App listing — each customer creates their own Custom App and pastes credentials.
- No auto-creation on `orders/create` — only on paid.

## Technical notes

- HMAC verification reuses the pattern already in `supabase/functions/shopify-webhook/index.ts` but uses the per-store secret instead of a single env var.
- The existing `shopify-webhook` (for your own Shopify) stays untouched — this is a new, parallel function scoped per-customer.
- Access tokens and webhook secrets go into Supabase Vault, mirroring the existing webhook secret pattern (`create_webhook_secret` function).
- All new tables get the standard `GRANT` block + RLS policies (`has_role` based).