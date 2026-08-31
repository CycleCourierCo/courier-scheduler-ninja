# Give B2B customers access to the Shopify integration page

(There is no separate "Shipday" page in the portal — the customer-facing integration page is Shopify Integration at `/shopify-integration`, which is what this covers.)

## Cause (verified)

Access is driven by the role/route permission matrix. In `role_route_permissions`, the row for `role = b2b_customer`, `route_key = shopify-integration` is `allowed = false`, and the route's built-in default roles are `["tech"]` only. So `ProtectedRoute` redirects B2B users away and the page never appears in their menu.

The underlying data access is fine: RLS on `customer_shopify_stores`, `customer_shopify_order_log` and `customer_shopify_skus` already scopes rows to `user_id = auth.uid()`, and the page itself has no admin-only gate.

## Changes

1. Migration: set `allowed = true` for `role = b2b_customer`, `route_key = 'shopify-integration'` in `role_route_permissions`.
2. `src/config/routes.ts`: add `b2b_customer` to the `defaultRoles` for the `shopify-integration` route so a "Reset to defaults" in the Route Permissions admin page keeps the access.
3. `src/components/Layout.tsx`: make sure the customer menu shows the Shopify Integration link for B2B users (currently only in the admin menu), so they can reach it without typing the URL.

## Verification

- Sign in as a B2B customer and confirm `/shopify-integration` loads and the store connect/SKU sections work against their own rows.
