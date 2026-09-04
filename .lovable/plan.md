# Confirm approved repairs to the receiver by email

## What happens today

When the receiver approves repairs on the public offer page, the only email they get is the invoice email raised by `create-receiver-inspection-invoice` — it lists the approved repairs, the total including VAT, a pay link and the PDF. If QuickBooks or the invoice step fails (or takes a while), the receiver gets nothing at all and has no record of what they just agreed to.

## What changes

1. **Immediate confirmation email.** The moment the receiver submits their approval, they get a "Thanks — here's what you approved" email listing each repair they accepted with its price and the total including VAT, the bike and CCC tracking number, and a note that a separate invoice with a pay link follows shortly. This email does not depend on QuickBooks, so it always lands.
2. **Invoice email unchanged.** The one-invoice-per-bike email (repair line items, pay link, PDF attachment) still follows as it does now.
3. **Failure visibility.** If the invoice can't be raised, admin (`Info@cyclecourierco.com`) is notified that the receiver approved repairs but no invoice went out, so it can be raised manually from the inspection card. The receiver's approval and confirmation email still stand.

## Technical notes

- Confirmation send happens inside `finalise-public-repair-offer` (public, `verify_jwt = false`), before the background invoicing work: read the just-approved receiver-billed issues, group by inspection/order, send one email per bike via Resend.
- From `CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>`, `reply_to: Info@cyclecourierco.com`; all order/repair text HTML-escaped, no PII in logs.
- Add a `receiver_confirmation_sent_at` stamp on `inspection_issues` so a retry or double submit can't send the confirmation twice.
- Admin failure alert reuses the existing Resend helper pattern in the same function; no new function needed.
- Receiver email and repair descriptions come from the order `receiver` JSONB snapshot and `inspection_issues`, consistent with existing invoice logic.
