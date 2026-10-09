# Project architecture

- Public inspection decisions go through the `public-inspection-approval` Edge Function; privileged database approval helpers remain service-role-only to prevent direct browser execution.
- Warehouse bike-storage anniversaries are calculated in Europe/London and billed through the weekly QuickBooks invoice path with a service-role-only bike-month ledger, so missed months can be caught up without duplicate charges.
- Unboxed-bike preparation emails are sent from the order-creation background workflow to the collection contact and use an atomic order timestamp claim to prevent duplicates.
- Order-to-invoice associations use a dedicated many-to-many table; QuickBooks staff URLs are visible only to admin and customer-service roles.
- All collection labels share the renderer in labelUtils and preload original thermal artwork bytes before rendering; this preserves one-bit native-resolution images and consistent overflow protection across single, bulk and loading outputs.- Bookable product names come from one master list in the bike pricing constants; booking dropdowns, API and consistency report all read it so names cannot drift.
- Order cancellation time/user is stamped by a database trigger on orders.status; the cancelled-but-invoiced audit reads it with order_invoice_links, so every cancel path is covered.
