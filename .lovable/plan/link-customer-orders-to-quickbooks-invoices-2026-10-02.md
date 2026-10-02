# Link customer orders to QuickBooks invoices

## Goal
Give staff a direct **View in QuickBooks** link on each customer order, covering existing invoices as well as invoices created from now on.

## What will change

### 1. Keep an order-to-invoice record
- Add a secure order invoice-links record containing the order, QuickBooks invoice ID and number, QuickBooks staff URL, invoice date, and link source.
- Allow more than one invoice per order so transport, inspection, guaranteed-delivery, or other charges can all remain visible without overwriting each other.
- Only authorised staff can read these links; customers will not receive or see the internal QuickBooks URL.

### 2. Link new portal-created invoices automatically
- When the existing invoice process successfully creates a QuickBooks invoice, save a link for every order actually represented by its invoice lines.
- Use the same logic for manual invoice creation and the weekly invoice run, because both already pass through the shared QuickBooks invoice function.
- Do not link an order whose billable product was skipped from the invoice.

### 3. Backfill existing QuickBooks invoices
- Add an admin-only synchronisation action that reads all QuickBooks invoices in pages and matches their line descriptions to exact Cycle Courier tracking numbers.
- Create links only for exact, unique matches. Never guess using customer name, email, amount, or date alone.
- Make the sync repeat-safe and report linked, already linked, unmatched, and ambiguous counts.
- Include invoices made directly in QuickBooks when their lines contain the order tracking number.

### 4. Show links on each order
- Add an **Invoices** section to the order page for admins and customer-service staff.
- Show invoice number and date, with a **View in QuickBooks** button opening the internal QuickBooks invoice.
- Show a clear “No linked invoice” state when none has been matched.

### 5. Add the backfill control
- Add **Sync order invoice links** to the existing Invoices page for admins.
- Display the last run result and any unmatched/ambiguous totals so gaps remain visible rather than being silently linked incorrectly.

## Technical notes
- Current transport invoice lines already include the tracking number, providing a reliable exact-match key for historical reconciliation.
- Current invoice history stores invoice-level details but not the individual order IDs, so a dedicated many-to-many link record is needed.
- There are currently 1,405 invoice-history records, 1,386 with QuickBooks IDs, and 7,059 delivered orders; QuickBooks and database reads will therefore be paginated beyond the 1,000-row limit.
- QuickBooks access and matching will run server-side with admin validation; internal invoice URLs will not be exposed through customer-facing data.
