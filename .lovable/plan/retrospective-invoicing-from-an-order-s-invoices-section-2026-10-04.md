# Retrospective invoicing from an order's Invoices section

## What the user sees
On an order page, the Invoices section shows a **Create invoice now** button when:
- the job is delivered (or its delivery date has passed),
- it has no linked invoice,
- it isn't a website (Shopify) order and isn't marked "not to be invoiced",
- the viewer is an admin.

Pressing it opens a small confirm box showing who will be billed (the order's account), the job's tracking number, bikes and the estimated price. Confirm creates the QuickBooks invoice for just this job, saves the link, and the section refreshes to show **View in QuickBooks**.

Customer service staff still see the section but not the button. If the job is excluded, a note says why instead.

## How it works
- Reuses the existing invoice creator (same products, special/big-bike rates, VAT, extras like inspection or guaranteed delivery, tracking number in each line), sent just this one order with the order's account as the customer.
- The invoice creator already writes the order-to-invoice link, so the new invoice also counts in Route Profitability.
- Before creating, it re-checks the order has no link yet so a double press can't make two invoices.
- Errors (e.g. QuickBooks not connected, account has no QuickBooks customer) show as a clear message.

## Technical notes
- `OrderInvoiceLinks.tsx`: accept the order (status, delivery date, user_id, tracking etc.), check admin role, Shopify profile and `order_invoice_exclusions`; add confirm dialog; on confirm invoke `create-quickbooks-invoice` with `{ customerId: order.user_id, customerEmail, customerName, startDate/endDate = order created date, orders: [order], singleOrder: true }`; reload links after.
- `create-quickbooks-invoice`: when `singleOrder` is set, skip if `order_invoice_links` already has a row for that order (return the existing link), and skip storage charges.
- Parent order page passes the order object instead of just the id.
- No database changes.
