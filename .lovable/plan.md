# Let customer service add inspections to orders, with the right invoicing

## What will change
- Customer service staff will see the **Inspection only** and **Inspection and service** buttons on an order, the same as admins.
- When either button is pressed, the app checks whether the order's transport has already been invoiced in QuickBooks:
  - **Already invoiced:** a separate inspection invoice is raised straight away for the inspection and service. For an inspection-only booking, the service is only invoiced if the customer later accepts it, as it works today.
  - **Not invoiced yet:** nothing extra is raised. The inspection is added to the normal weekly invoice.
- A message confirms what happened: "Inspection added — invoice INV-123 created" or "Inspection added — it will be on the next weekly invoice".
- If the invoice can't be raised (for example the customer isn't found in QuickBooks), the inspection is still added, and the message gives the reason so staff can use **Create Inspection Invoice** later.
- The order won't be invoiced twice: if an inspection invoice already exists, no second one is raised.
- **Remove inspection** stays admin-only.

## Technical details
- `OrderServicesPanel.tsx`: allow `admin` or `customer_service` for enable/invoice actions; after `enableInspectionForOrder`, call the new server check.
- `create-inspection-service-invoice`: accept `admin` or `customer_service` (from `user_roles`/profile role, checked on the server). Add `mode: "after-enable"`: if the order has no link in `order_invoice_links` (and no legacy `quickbooks_invoice_id`), return `{ deferred: true }`; otherwise create the invoice. Skip if an inspection invoice is already recorded for the order.
- Check that the weekly invoice path (`create-quickbooks-invoice`) adds the "Bike Inspection & Service" line for `needs_inspection` orders, and respects inspection-only service decisions; fix it if not.
- Check the database rule on enabling inspection allows customer service to update `needs_inspection`/`inspection_type`; add a narrow staff-only function if not.
- Add a small test for the invoiced/not-invoiced decision.
