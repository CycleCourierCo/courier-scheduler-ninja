# Move fragile browser work onto the server

## Why
Some jobs run in the staff member's or customer's browser, one step after another. If the page is closed, the phone loses signal or the tab sleeps, the job stops half-done (for example, dates saved but no confirmation email). The van-loading fix was this kind of problem.

## Confirmed candidate
1. **Customer date submission** (sender and receiver availability pages). After the dates save, the browser then sends the "dates confirmed" email, the receiver's availability email and the Northern Ireland ferry booking. If the customer closes the page straight after pressing Submit, those can be missed. Move them into one server step that runs after the dates save, with a guard so nothing sends twice.

## Likely candidates (check each first, then move only the ones that really loop in the browser)
2. **Bulk order upload**: creating many orders from a spreadsheet one at a time.
3. **Inspections**: the inspection screens make the most separate saves in the app. Group multi-step actions (status change, invoice, messages) into single server steps.
4. **Invoices page**: bulk linking or syncing invoices from the browser.
5. **Announcement emails**: sending to many people from the page.
6. **User management**: multi-step changes to a user (roles, profile, sign-in email).
7. **Fuel invoice upload**: saving many fuel lines one by one.
8. **Route generation**: saving many route stops one by one.

## Order of work
- Step 1: check items 2-8 and drop any that are already safe.
- Step 2: build item 1, then the rest in order of risk (money and customer messages first).
- Each move keeps the same buttons and wording; staff should only notice it is faster and doesn't break if they leave the page.
- Add a small test for each "never send or charge twice" rule.

## Technical notes
- Pattern: one SECURITY DEFINER database function per bulk write (role-checked, max batch size), or an Edge Function using `EdgeRuntime.waitUntil()` for emails/WhatsApp/Shipday/QuickBooks.
- Item 1: extend `set_order_availability` flow so the emails and ferry call are triggered server-side with timestamp claims; `availabilityService.ts` just calls the RPC.
- Record the rule in AGENTS.md: multi-step writes and customer messages run on the server, not as browser loops.
