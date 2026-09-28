# Monthly warehouse storage on weekly invoices

## What will happen
- Charge **£40 per bike per month, including VAT**, starting when each bike is added to warehouse stock. Each next charge falls on that bike's monthly anniversary. No new monthly charge is raised after it leaves storage; months already begun are charged in full (no part-month refund).
- Put each charge on that customer's **weekly QuickBooks invoice for the week its monthly charge falls due**, alongside any transport charges. A customer with storage charges but no new transport orders still gets an invoice. Only bikes count, not stored components.
- Show the bike, warehouse arrival date, and storage month on each invoice line; keep a charge record so rerunning the weekly process does not bill the same bike-month twice. Surface missing QuickBooks products or failed invoices rather than silently omitting storage.

## What to do in QuickBooks
1. Create an active **Service** product named exactly **Warehouse Bike Storage**.
2. Set its sales price to **£33.33 before VAT**, and set its VAT rate to the **UK standard 20%**. This makes the invoice line **£40.00 including VAT**. Assign the appropriate storage income account.
3. Keep your existing QuickBooks connection and the customer's QuickBooks record/accounts email as usual. Do not create an automatic recurring invoice in QuickBooks; this platform will add the charge to the weekly invoice.

## Technical approach
- Add a restricted storage-charge ledger keyed by warehouse stock item and monthly period, with a unique constraint and invoice linkage. Use the recorded deposit and dispatch timestamps to calculate due anniversaries in Europe/London; handle months without the original day by using the month's last day. Invoice an outstanding period only once, including any missed periods without generating duplicate charges.
- Update the shared QuickBooks invoice creator to load due bike-storage charges on the server, create a separate line per bike-month at the fixed VAT-exclusive price, and record successful billing against the QuickBooks invoice. Make missing product/tax configuration fail safely before sending an incomplete invoice, and reconcile ambiguous QuickBooks-create failures before retrying.
- Make the scheduled weekly batch and the Invoices page's single-customer and bulk actions include storage-only customers, storage totals, and storage failures. Keep invoicing based on the customer who owns the stock, not the transport order's booking date.
- Test anniversary dates, VAT rounding, bikes leaving storage, orders plus storage, storage-only weeks, missing products, and reruns. Check the resulting QuickBooks line and ledger before treating billing as verified.

**Existing behaviour confirmed:** Weekly invoicing currently selects customers with orders created in the chosen week; warehouse bike stock records a deposit date and owning customer but is not currently included in invoice lines. There are three stored bikes in the current records. This change does not retroactively send invoices immediately; charges become eligible in the next weekly run after setup.
