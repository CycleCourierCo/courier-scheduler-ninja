# Project architecture

- Below laptop width the inbox shows either tickets or the route-selected conversation, with details in a sheet and collapsible ticket controls; its height is measured below the site header so only message history scrolls and the reply box remains visible.

- Public inspection decisions go through the `public-inspection-approval` Edge Function; privileged database approval helpers remain service-role-only to prevent direct browser execution.
- Warehouse bike-storage anniversaries are calculated in Europe/London and billed through the weekly QuickBooks invoice path with a service-role-only bike-month ledger, so missed months can be caught up without duplicate charges.
- Unboxed-bike preparation emails are sent from the order-creation background workflow to the collection contact and use an atomic order timestamp claim to prevent duplicates.
- Order-to-invoice associations use a dedicated many-to-many table; QuickBooks staff URLs are visible only to admin and customer-service roles.
- All collection labels share the renderer in labelUtils and preload original thermal artwork bytes before rendering; this preserves one-bit native-resolution images and consistent overflow protection across single, bulk and loading outputs.- Bookable product names come from one master list in the bike pricing constants; booking dropdowns, API and consistency report all read it so names cannot drift.
- Order cancellation time/user is stamped by a database trigger on orders.status; the cancelled-but-invoiced audit reads it with order_invoice_links, so every cancel path is covered.

- Bulk van loading goes through the load_orders_onto_van database function in one call — avoids per-bike saves and page reloads that lock the Loading page.
- Staff-visible pages must be added to the hardcoded ADMIN_MENU_SECTIONS list in Layout.tsx as well as the route/permissions config — the admin menu does not read the permissions matrix, so a page can be reachable yet absent from the menu.
- Order webhooks fan out to customer webhook configs and to partner apps (oauth_clients.webhook_url) the customer has an active OAuth grant with, deduped by URL — a sign-in connection alone must be enough for a partner to receive updates.
- Customer SMS goes through supabase/functions/_shared/divergentSms.ts (Divergent Connect), sent alongside WhatsApp and logged in sms_messages; delivery/replies arrive at divergent-webhook — one helper keeps sender, length limit and logging consistent.
