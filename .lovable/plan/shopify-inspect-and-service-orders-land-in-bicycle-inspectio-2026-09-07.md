# Shopify "Inspect and Service" orders land in Bicycle Inspections

## What happens today

Order CCC754778897114HAYKT2 (Shopify 2116) came in through the Shopify order webhook and was created as a normal collection and delivery: it is not marked as needing inspection and has no inspection record, so it never appears on the Bicycle Inspections page.

Two reasons:

- The webhook never looks for a service product. Nothing in it recognises "Inspect and Service".
- It only reads the **first** line on the Shopify order for all the details (bike, collection and delivery addresses). Any second line, such as the service product, is ignored entirely — and if the service line happened to come first, the bike and address details would be read from the wrong line.

The raw Shopify data for order 2116 is no longer in the logs (they only keep a short window), so the match is built to cope with either shape it can arrive in.

## What changes

1. **Recognise the service product.** When a paid Shopify order includes "Inspect and Service" — matched on the SKU `BKE-INS`, or on the product title when there is no SKU (as on order 2116), or on a yes/no add-on option of that name on the bike line — the order is created as needing inspection and service.
2. **It shows up in the workshop.** Such orders appear on the Bicycle Inspections page ready to be inspected, exactly like inspection orders booked through the portal, and the delivery-dates request to the receiver is held back until the workshop has finished — which is already how inspection orders behave.
3. **The bike line is picked correctly.** The bike details and the collection/delivery addresses are always read from the transport line, never from the service line, so adding the service can't scramble the addresses.
4. **Clear record.** The webhook logs which line matched and why, so if a future order misses it we can see immediately what Shopify sent.
5. Order 2116 is left as it is, as agreed — staff can turn on inspection for it from the order if they want it in the workshop.

## Technical notes

- `supabase/functions/shopify-webhook/index.ts`:
  - Add an `isInspectServiceItem(item)` helper: SKU equals `BKE-INS` (case/whitespace-insensitive), or title normalises to `inspect and service`, or a line-item property named `Inspect and Service` / `Inspection and Service` with a truthy value (`yes`, `true`, `1`).
  - Split `line_items` into service items and transport items; use the first transport item (falling back to `line_items[0]` when every line is a service line) as the source for properties, bike brand/model/type/value and quantity.
  - Pass `needsInspection: true` in the `ordersApiBody` when any service item is present. `supabase/functions/orders/index.ts` already maps `needsInspection` onto `orders.needs_inspection`, so no change is needed there.
  - Keep the existing `console.log` of the parsed line items, plus a line naming the matched service SKU/title.
- No schema change: `orders.needs_inspection` already drives `getPendingInspections`, the workshop gate in `servicingGate.ts`, and the deferred receiver-availability logic in `inspectionService.ts`. The `bicycle_inspections` row is created on first open by `getOrCreateInspection`, matching portal-booked inspection orders.
- Deploy `shopify-webhook` after the change.
