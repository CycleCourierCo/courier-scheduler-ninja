# Inbound Northern Ireland: one collection day, then book the ferry partner

## 1. Ask the NI customer for one collection day

For inbound jobs (bike starts in Northern Ireland), the collection availability page changes:

- The customer picks **one single day**, not seven, and the wording says so ("Choose the day the bike will be ready for collection").
- The calendar only offers days in the **next 2 weeks** (weekends/Fridays/holidays stay blocked as they are today).
- Submitting saves that single day as the confirmed collection date.

Everything else on that page (postcode identity check, notes) stays the same. Mainland collections keep the current "pick at least 7 dates" behaviour, and receiver availability is untouched.

## 2. Email the ferry partner once the day is agreed, not at booking

Today City Air Express gets the booking email seconds after the order is created, before anyone knows when the bike can be collected.

- Inbound orders **no longer** email the ferry partner at booking (website, bulk upload, orders API and Shopify).
- Instead the email goes out as soon as the NI customer confirms their collection day, and it now states that date clearly ("Please collect on Tuesday 23 September").
- Still a one-time send, so nothing can double up, and the manual "notify ferry partner" button on the order page still works as a backup at any time.
- Outbound (mainland to NI) orders keep emailing the partner at booking, unchanged.

## 3. Collection date on the Box My Bike card

The Inbound NI cards on the Box My Bike page show the agreed collection date (or "No date yet" when the customer hasn't chosen), next to the existing tracking and stage details.

## Technical notes

- `src/components/availability/AvailabilityForm.tsx`: add `requiredDates` (default 7) and `maxDates` props; drive the validation text, selected-dates copy and submit-button guard from them so a value of 1 gives single-day selection.
- `src/pages/SenderAvailability.tsx`: detect inbound via `isInboundNi(order)` from `src/utils/niDelivery.ts`; pass `requiredDates={1}`, `maxDates={1}`, inbound-specific title/description, skip the business "available now / later" prefill branch (it selects 7 days).
- `src/hooks/useAvailability.tsx`: accept a `requiredDates` option, use it in the `handleSubmit` guard instead of the hard-coded 7; add a `calendarEndDate` cap of `addDays(today, 14)` when `requiredDates === 1`.
- `src/services/availabilityService.ts` `updateSenderAvailability`: accept a minimum-dates argument (default 7) so the single-date submission isn't rejected by the `< 7` guard; after a successful `set_order_availability`, when the order is inbound NI invoke `send-ferry-partner-notification` (fire-and-forget, non-blocking).
- `src/services/orderService.ts` and `src/services/bulkOrderService.ts`: only fire the creation-time ferry notification when `niDirection === 'outbound'`.
- `supabase/functions/orders/index.ts` (~line 560-590): same direction guard around the background ferry email and `ferry_partner_notified_at` stamp.
- `supabase/functions/_shared/ferryPartnerEmail.ts`: add an optional `pickup_date` to the input and, for inbound, render a "Requested collection date" block; `send-ferry-partner-notification/index.ts` adds `pickup_date` to its `select` and passes it through.
- `src/components/boxmybike/InboundNiSection.tsx`: add `pickup_date` to the `InboundOrder` interface and query select, and render the first confirmed date on the card.

No database or RLS changes are needed — the collection day is stored in the existing `orders.pickup_date`.
