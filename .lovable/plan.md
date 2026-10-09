# One product list everywhere

Today the product names and prices live in several places that drift apart: the QuickBooks Products page, the Pricing page, the bike-type dropdown on Create Order (plus bulk upload and the API's numeric IDs), and the products on the Shopify shop. Names already differ (for example "Tandem" vs "Tandem Bikes", "Trike" vs "Small Trike").

## Goal
One master product list in the app. Every other place reads from it or is checked against it.

## Steps

1. **Comparison report first (no changes)**
   A new "Product consistency" view on the QuickBooks Products page that lists every product side by side:
   app master | Pricing page | booking dropdown | QuickBooks item + price | Shopify product + price.
   Mismatches (missing, different name, different price) are highlighted. You review this and decide the correct name and price for each.

2. **Master product list**
   A single product table in the app: name, price (ex VAT), VAT, linked QuickBooks item, linked Shopify product/variant, API ID, old names (aliases) so past orders still match, active/hidden.
   Seeded from today's pricing list. Admin-only editing.

3. **App reads from the master list**
   - Pricing page shows the master list.
   - Create Order dropdown, bulk upload and the API use it (existing API numbers stay the same).
   - Invoices and profitability estimates price from it; special customer rates and big-bike rates still win.
   - Old orders keep their saved bike type; aliases map them to the right product.

4. **Keep QuickBooks in line**
   From the master list, admins can push name/price updates to the linked QuickBooks item (never deleting, only deactivating — as now). A product with no QuickBooks link is flagged.

5. **Keep Shopify in line**
   Read Shopify products and prices, link each to a master product, and flag differences. Option to push price/title updates to Shopify (needs product write permission on the Shopify connection). Shopify orders coming in map to the master product via the link instead of name guessing.

## Questions to settle during step 1
- Which wins when prices differ: the app, QuickBooks, or Shopify?
- Should Shopify be updated automatically, or only flagged for you to change?
- Do Shopify prices include VAT (likely) while the app is ex VAT? The comparison will convert.

## Technical details
- New table `products` (+ `product_aliases`), RLS: read for signed-in staff, write admin via user_roles.
- Replace hard-coded maps in `src/constants/bikePricing.ts` with a cached hook; keep a static fallback for the public API mapping.
- Extend `quickbooks-products` edge function with update-by-link; new `shopify-products` function (list + optional update) using the existing Shopify connection.
- Touch: OrderDetails/OrderOptions, bulkOrderService, ItemDetails, Pricing page, QuickBooksProducts, shopify-webhook line-item mapping, orders API.
- No change to existing invoices.
