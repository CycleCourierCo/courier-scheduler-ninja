# Show guaranteed delivery status and details on the order

## What's wrong

The card is written to show a "Guaranteed" summary once the flag is set, but the order object handed to it never carries the guarantee fields. `mapDbOrderToOrderType` (`src/services/orderServiceUtils.ts`) builds the order from an explicit field list and none of the `guaranteed_delivery*` columns are in it, so `order.guaranteed_delivery` is always undefined and the card falls back to the plain button — even right after saving, and after the 5-second poll refresh.

## Fix

1. Carry the fields through the mapper so the saved state is visible:
   - `guaranteedDelivery`, `guaranteedDeliveryPayer`, `guaranteedDeliveryAmount`, `guaranteedDeliveryNote`, `guaranteedDeliveryMarkedAt`, `guaranteedDeliveryMarkedByName`, `guaranteedDeliveryInvoiceNumber`, `guaranteedDeliveryInvoiceId`, `guaranteedDeliveryInvoiceUrl`, `guaranteedDeliveryInvoicedAt`
   - Keep the raw snake_case keys on the mapped object too, so existing code reading `order.guaranteed_delivery_*` keeps working.
   - Add the camelCase fields to the `Order` type in `src/types/order.ts`.

2. Make the confirmed state read as complete in `GuaranteedDeliveryCard.tsx`:
   - Green "Guaranteed" state with a check icon in the header and a completed-looking badge row.
   - Details shown: amount (excl. VAT), who is paying (with sender/receiver name), who marked it and when (Europe/London), the note, and invoice number as a link when a standalone invoice was raised.
   - For account-billed guarantees, keep the "will be added to their next weekly invoice" line.
   - Keep Edit and Remove; Edit pre-fills payer, amount and note from the saved values instead of resetting to defaults.

3. Also surface a small "Guaranteed date" badge near the order header/status area so staff can see it without scrolling to the card.

## Technical notes

- Files: `src/services/orderServiceUtils.ts`, `src/types/order.ts`, `src/components/order-detail/GuaranteedDeliveryCard.tsx`, `src/pages/OrderDetail.tsx` (badge placement only).
- No database or edge function changes; the columns and invoicing logic already exist.
- Mobile: keep the existing wrapping/`break-words` patterns so the details block doesn't overflow on narrow screens.
