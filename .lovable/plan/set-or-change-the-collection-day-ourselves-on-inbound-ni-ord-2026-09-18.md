# Set or change the collection day ourselves on inbound NI orders

Today the collection day on an inbound Northern Ireland order can only be chosen by the customer through their availability link, and the booking email to City Air goes out once when that happens. Staff have no way to set a day or correct one, and the only email control is a plain resend.

## What changes

- On the Box My Bike page, each inbound NI card gets an edit control next to "Collection day". Staff can set a day when the customer hasn't picked one, or change the day that's there.
- The same control appears on the order page in the Northern Ireland panel, so the day can be set from wherever staff are working.
- Day picking follows the existing inbound NI rule: Monday to Friday only, no weekends, no holidays, no past dates.
- Saving a day emails City Air straight away with the day on it, even if they were emailed before. When it's a change to a day they already had, the email is clearly marked as an updated booking so they don't treat it as a new job.
- The card and panel show when the partner was last emailed, so it's obvious the change went out.
- Nothing changes for outbound NI orders, and the customer's own availability link keeps working exactly as it does now.

## Technical notes

- `src/components/boxmybike/InboundNiSection.tsx`: new `CollectionDayDialog` (calendar with weekday-only/holiday/past-date disabling reused from the inbound availability picker helpers) writing `pickup_date: [YYYY-MM-DD]` on the order, then invoking `send-ferry-partner-notification` with `{ orderId, force: true, updated: <true when a day already existed> }`. Invalidate `inbound-ni-orders`.
- `src/components/order-detail/NorthernIrelandEditor.tsx`: same dialog for inbound orders, displaying current `pickup_date[0]` and `ferry_partner_notified_at`; reuses the existing resend plumbing.
- `supabase/functions/_shared/ferryPartnerEmail.ts`: accept an optional `isUpdate` flag; when set, prefix the subject with `UPDATED — ` and add a short "this replaces the previously booked day" note above the collection-day block.
- `supabase/functions/send-ferry-partner-notification/index.ts`: pass `body.updated` through to `buildFerryPartnerEmail`; auth, idempotency and `ferry_partner_notified_at` stamping stay as they are.
- Store dates as `YYYY-MM-DD` strings in Europe/London, matching the existing availability convention; no schema change needed.
- Verify with `bun run build` plus a manual set/change on one inbound NI order.
