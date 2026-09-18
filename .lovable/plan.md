# Guaranteed date jobs panel on Job Scheduling

## What's missing today

The guaranteed delivery popup on an order captures who pays, the amount and a free-text note, but no actual date — confirmed by the order columns (`guaranteed_delivery`, `_payer`, `_amount`, `_note`, invoice fields, no date column). So the route builder has nothing to sort or highlight by.

## What we'll build

1. **A date on the guarantee**
   - Add a "Guaranteed delivery date" picker to the guaranteed delivery popup, required when turning the guarantee on.
   - Show the date in the confirmed state on the order, and pre-fill it when editing.
   - Show the date on the small guarantee badge in the order header.

2. **New "Guaranteed dates" section at the top of the Route Builder**
   - Lists every order that still has work outstanding (collection or delivery not done, not cancelled/delivered) and has a guaranteed date.
   - Sorted soonest-first, with colour cues: red for overdue or today, amber for within 2 days, neutral beyond that.
   - Each row shows: tracking number, customer/receiver name, town and postcode, which leg is outstanding, the guaranteed date with days remaining, bike count, and whether the collection has been booked.
   - Clicking a row adds that job into the route being built, exactly like the normal job list does.
   - The section collapses and shows a count, and hides itself entirely when nothing is guaranteed.
   - Rows disappear once both legs are complete.

## Technical notes

- Migration: add `guaranteed_delivery_date date` to `public.orders`; cleared alongside the other fields in `clearGuaranteedDelivery`, set in `setGuaranteedDelivery`.
- Files: `supabase/migrations/*` (new), `src/services/orderService.ts`, `src/services/orderServiceUtils.ts` (map both `guaranteedDeliveryDate` and snake_case), `src/types/order.ts`, `src/components/order-detail/GuaranteedDeliveryCard.tsx`, `src/pages/OrderDetail.tsx` (badge text), `src/pages/JobScheduling.tsx` (`OrderData` gains the field — the query already selects `*`), new `src/components/scheduling/GuaranteedDatePanel.tsx` rendered at the top of `src/components/scheduling/RouteBuilder.tsx`.
- Outstanding-leg logic reuses `needsCollectionLeg` / `needsDeliveryLeg` from `src/components/scheduling/heatJobPoints.ts` so it matches the maps.
- Date handling uses `yyyy-MM-dd` strings and Europe/London formatting, consistent with the rest of the scheduling code.
- No change to invoicing or the surcharge calculation.
