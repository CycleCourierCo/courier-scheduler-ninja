## Problem

The grouped timeslot email to the ferry hand-off contact lists all bikes in the "Deliveries:" line, but only prints **one** `NI RECEIVER` block — the one for the primary order the request was sent with.

Confirmed in `supabase/functions/send-sendzen-whatsapp/index.ts`: the handler passes only the primary `order` into `sendEmail`, and the email body renders a single `formatNiReceiverBlock(order.receiver, order.tracking_number)`. The `relatedJobs` array (the other jobs in the grouped stop) is used for Shipday updates only, never for the email.

## Fix

In `send-sendzen-whatsapp`:

1. In the handler, when `type === "grouped_timeslot"`, fetch the orders for all `relatedJobs` entries with `jobType === "delivery"` (single `.in('id', ids)` query) and pass them, plus the primary order, into `sendEmail` as a list of NI delivery orders.
2. In `sendEmail`, replace the single NI block with a loop: render one `formatNiReceiverBlock(o.receiver, o.tracking_number)` panel per NI delivery order (deduped by order id, skipping non-NI orders), under a heading like "Final destinations".
3. Keep existing behaviour unchanged when there are no related jobs or the order isn't NI (single block / normal tracking-link line).

Optionally apply the same multi-receiver rendering to the grouped path in `send-timeslot-whatsapp/index.ts` (line ~255), which has the same single-block limitation, so both send paths stay consistent.

## Technical notes

- No schema changes; no WhatsApp template changes (the WhatsApp body already uses the aggregated job list).
- Both functions get redeployed after the edit.
