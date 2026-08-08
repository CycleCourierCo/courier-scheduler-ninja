# Fix inspection invoicing for CCC754980293576SIMME2

## What's actually wrong

The order and its inspection are in a perfectly invoiceable state:

- Inspection status `repaired`, no invoice yet (`invoice_number` is empty).
- One issue: "[Brake and gear tuning] new caliper", status `repaired`, customer response `Approved`, cost £30.

So the "Create Invoice" button is allowed to show, and the billable-issue check inside the invoice function passes.

The blocker is the billing identity. This order was booked under the internal admin account (`Abdullah Admin`, email and accounts email both `Info@cyclecourierco.com`). The invoice function looks up the QuickBooks customer purely by that profile email, and there is no QuickBooks customer with our own company inbox — so it stops with "Customer not found in QuickBooks for email: Info@cyclecourierco.com" and returns a generic edge function error to the page.

Two separate problems fall out of that:

1. Repair invoices for orders booked on an internal/admin account can never be raised, because the profile email is ours, not the paying customer's.
2. When any lookup fails, the page shows an unhelpful failure with no indication of which step failed.

## The fix

**1. Let the admin pick the customer when auto-match fails.** Instead of a bare error, the inspection card opens a "Choose billing customer" dialog: a searchable list of live QuickBooks customers plus a free-text billing email field. The admin picks the right customer and the invoice is raised against them, using that address as the invoice BillEmail.

**2. Try the real payer on the order automatically first.** Before falling back to the dialog, look up the QuickBooks customer by, in order:
   - the profile's accounts email, then profile email (current behaviour), then
   - the sender's email on the order snapshot, then the receiver's email,
   - and also match by customer/company name if no email matches.
   Skip any candidate that is one of our own internal addresses (`@cyclecourierco.com`) so an internal booking never invoices ourselves.

**3. Make the errors readable.** Surface the real reason on the toast (customer not matched, "Bike Repair" product missing, QuickBooks not connected, QuickBooks rejection detail) rather than a generic "Failed to create invoice".

**4. Then raise this specific invoice** for CCC754980293576SIMME2 against the correct customer and confirm the invoice number lands on the inspection card.

## Technical notes

- `supabase/functions/create-inspection-invoice/index.ts`: build an ordered candidate list for the QuickBooks customer query (accounts_email, email, order.sender.email, order.receiver.email), filter out `@cyclecourierco.com`, add a name-based `Customer` query fallback, accept an optional `billingEmailOverride` / `quickbooksCustomerId` in the request body, and return `{ error, candidates }` with a `409` when nothing matches. Add a `mode: "search-customers"` branch that returns matching QuickBooks customers (name + email + id) for a search term so the dialog lists real customers. Keep the existing escaping of QuickBooks query strings.
- `src/pages/BicycleInspections.tsx`: read the structured error from the function response, show the specific message, and add a "Choose billing customer" dialog (searchable QuickBooks customer list + billing email field) that re-invokes the invoice function with the chosen customer.
- No schema change needed.
