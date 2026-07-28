## What's wrong

`supabase/functions/send-timeslot-whatsapp/index.ts` has no Northern Ireland awareness. On a delivery leg it does `const contact = order.receiver` and uses that for:

- the WhatsApp send (`contact.phone`),
- the email send (`to: [contact.email]`),
- the Shipday job update, where `jobContact = orderToUpdate.receiver` supplies `customerName`, `customerAddress`, `customerEmail`, `customerPhoneNumber`.

So for an NI order the timeslot goes to the customer in Northern Ireland, and the Shipday delivery job gets rewritten back to the NI address — which is also why the route timings look wrong.

Related, from the earlier investigation: `LoadRouteDialog` replays the `lat`/`lon` saved in `saved_routes.job_data` verbatim (only `orderData` is re-hydrated), so routes saved before an order was flagged NI still carry Belfast coordinates. And `CITY_AIR_EXPRESS.lat/lon` in `src/constants/depot.ts` (`53.4718, -2.2960`) is roughly 600 m off Unit 1 Ordinal Street, M17 1GB.

## Changes

**1. NI-aware recipient in the timeslot function** (`supabase/functions/send-timeslot-whatsapp/index.ts`)

- Import `CITY_AIR_EXPRESS` and `isNorthernIrelandAddress` from `_shared/northernIreland.ts`.
- Compute `isNI = order.is_northern_ireland === true || isNorthernIrelandAddress(order.receiver?.address)`.
- For `recipientType === "receiver"` on an NI order, resolve the contact to the hand-off name/phone/email/address instead of `order.receiver`. Collection legs are untouched.
- Append the NI receiver block (`formatNiReceiverBlock`) to the message/email body so the hand-off contact knows which bike and final destination the slot is for.

**2. NI-aware Shipday update in the same function**

In the per-job update loop, when the job is a delivery and its order is NI, set `customerName`, `customerAddress`, `customerEmail`, `customerPhoneNumber` to the hand-off details and add the `NORTHERN IRELAND — hand over` line plus the NI receiver block to the instructions — matching what `create-shipday-order` already does. This stops timeslot updates from reverting the Shipday job to the NI address.

**3. Self-heal stale route coordinates** (`src/components/scheduling/LoadRouteDialog.tsx`, `src/components/scheduling/RouteBuilder.tsx`)

When loading a saved route, rebuild each non-break stop from the live order via `getLegContact(order, type)` — overriding `lat`, `lon`, `address`, `contactName`, `phoneNumber` — instead of trusting the saved snapshot. Do the same refresh at the start of `calculateTimeslots` so a flag change mid-session is picked up. Breaks and stops with no matching order keep their saved values.

**4. Correct the hand-off coordinates** (`src/constants/depot.ts`)

Update `lat`/`lon` to the accurate Unit 1 Ordinal Street, M17 1GB point (approximately `53.4713, -2.3049`). Send exact coordinates if you have them and I'll use those.

## Deliberate behaviour

On the delivery leg of an NI order the customer no longer receives a timeslot message — the slot describes the drive to the Manchester hand-off, not their door. They still get the ferry-port confirmation email when the leg completes. Say the word if you'd rather they also get an informational "on its way to the ferry" note at timeslot time.
