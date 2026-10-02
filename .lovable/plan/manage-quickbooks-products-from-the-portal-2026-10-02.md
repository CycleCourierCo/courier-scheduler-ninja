# Manage QuickBooks products from the portal

Yes. A new admin-only **QuickBooks Products** page lets you see, add, edit and remove products without opening QuickBooks.

## What you can do
- **See all products**: name, type (Service / Non-inventory), sales price, VAT code, income account, and whether it's active. You can search and filter by active or inactive.
- **Add a product**: name, type, description, sales price (before VAT), VAT code (picked from your QuickBooks VAT codes) and income account (picked from your QuickBooks accounts).
- **Edit a product**: change any of the fields above. Changes save straight into QuickBooks.
- **Remove a product**: QuickBooks doesn't let anyone fully delete a product. It only lets you make it **inactive**, and that is what Remove will do. You can make it active again later.

## Safety
- You'll get a warning before renaming or removing a product the platform relies on, such as Warehouse Bike Storage, Bike Inspection & Service, Box My Bike, Guaranteed Delivery Date, or the special-rate products. Invoices find these by exact name, so renaming one would stop those invoices.
- Only admins see the page. It sits in the admin menu next to Invoices.

## Technical details
- New edge function `quickbooks-products` (admin JWT check, CORS, uses the existing stored QuickBooks token and refresh flow). Actions: `list` (Item query, paged), `list_refs` (TaxCode + Income Account), `create`, `update` (sparse update with SyncToken), `deactivate` / `reactivate` (Active=false/true). QbSQL strings escaped. No PII or tokens logged.
- New page `src/pages/QuickBooksProducts.tsx` with a table and an add/edit dialog. Route added to the routes config, and an entry added to the admin menu.
- A protected-name list is shared with the invoice functions so the warning matches the names they look up.
- No database changes. QuickBooks stays the source of truth, and nothing is cached.
