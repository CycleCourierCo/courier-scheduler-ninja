# Tidy old email colours and preview every email type

## What changes
- Swap the old blue that's still written into the older emails for the sage brand colours, so they look right without relying on the automatic switch at send time.
- Wording, recipients and timing all stay the same.
- Make sample pictures of each kind of email (order update, availability request, invoice, account approval, ferry partner, report, announcement) at desktop and phone widths, with the cream logo showing in the header.

## Technical notes
- Replace `#4a65d5` with `EMAIL_BRAND` tokens in: `src/services/emailService.ts`, `send-email`, `orders`, `send-order-updates`, `create-business-user`, `_shared/ferryPartnerEmail.ts`, `_shared/quickbooksInvoiceDelivery.ts`, `_shared/deliveryExpectations.ts`.
- Keep the rewrite inside `applyEmailBrand` as a safety net.
- Redeploy the affected functions. Render the sample HTML through `emailShell` and screenshot it with Playwright at 600px and 360px.
