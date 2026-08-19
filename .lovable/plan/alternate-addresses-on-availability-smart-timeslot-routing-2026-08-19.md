# Alternate addresses on availability + smart timeslot routing

Let customers give a neighbour and/or a workplace address with their own days/times, then have the planner's timeslot flow route to whichever address the chosen slot lands in — and push that address to WhatsApp and Shipday.

## 1. Availability pages (sender and receiver, non-business)

New optional section under the calendar on both `/sender-availability/:id` and `/receiver-availability/:id`:

- Checkbox: "Collect/deliver to a neighbour" -> text input for the neighbour's house number/name. Stored as an instruction only; routing stays on the main address.
- Checkbox: "Collect/deliver to my workplace during work hours" -> address search (Google Places, using the existing Google Maps loader) that captures full address, postcode and coordinates.
- When workplace is on: two day/time pickers
  - Work days + time window (e.g. Mon-Thu, 09:00-17:00)
  - Home days + time window (the rest)
- Validation: workplace requires an address and at least one work day/time window.
- Wording adapts to sender ("collect") vs receiver ("deliver").

Business senders/receivers keep the existing "available now / not yet" flow and do not see this section.

## 2. Business receiver flow

Mirror the sender behaviour on the receiver page when the logged-in business account matches the order's receiver contact:

- "Deliver during business hours" -> pre-fills the next 7 open days from their profile opening hours (editable), and appends the opening window summary to the delivery notes.
- "Specific dates" -> normal calendar picker.

## 3. Timeslot calculation and sending

In the route builder / timeslot dialog:

- For any job with a workplace address, compute travel time and arrival to both the home and work coordinates.
- Auto-pick: if the slot's day and start time fall inside the customer's work window, use the work address; otherwise home. The planner can flip the address per job in the timeslot popup.
- The popup shows the resolved address for each job, a small "Work address" / "Home address" badge, a "Neighbour: {number}" badge where set, and the alternate arrival time so the planner can judge the flip.
- Downstream ordering/arrival chain recalculates from the resolved coordinates, so the whole route's timings reflect the address actually being visited.
- WhatsApp/email message and the Shipday order edit use the resolved address (plus the neighbour instruction in the notes/delivery instructions).

## Technical notes

- New order columns (single migration, JSONB): `sender_alt_location` and `receiver_alt_location`, each holding `{ neighbour_number, work_address: { street, city, state, zipCode, lat, lon }, work_windows: [{ days, start, end }], home_windows: [...] }`. Also a `delivery_hours_mode` style flag on the business path is not needed — the mode is captured in the notes plus dates as today.
- `set_order_availability` RPC gains an optional `p_alt_location jsonb` parameter so the public (unauthenticated) availability pages can store it atomically alongside dates/notes; `availabilityService.updateSenderAvailability` / `updateReceiverAvailability` pass it through.
- `get_public_order` payload builder returns the alt-location object so the availability page can pre-fill on revisit and the planner reads it via the order row.
- `AvailabilityForm.tsx` gains the optional alt-address block as props-driven UI; a new `AltLocationFields.tsx` holds the checkbox/address-search/window pickers. Places autocomplete via `useGoogleMaps`.
- `businessAvailability.ts` helpers reused for the business receiver path in `ReceiverAvailability.tsx`.
- New helper `src/lib/altAddressResolution.ts`: given an alt-location record, a date and a start time, return `{ addressLabel, address, lat, lon, source: 'home' | 'work' }`.
- `RouteBuilder.tsx` and `MultiJobTimeslotDialog.tsx`: resolve coordinates per job through that helper before calling `computeRouteInOrder` / arrival chaining, add the badges and the per-job address toggle, and pass the resolved address into the `send-timeslot-whatsapp` invocation.
- `supabase/functions/send-timeslot-whatsapp/index.ts`: accept an optional resolved-address override per job and use it for both the message body and the Shipday `order/edit` payload, appending the neighbour instruction to delivery notes.
