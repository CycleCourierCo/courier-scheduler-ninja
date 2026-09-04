# Northern Ireland status emails + "crossed the ferry" badge on scheduling

Two changes, both building on what already exists.

## 1. Email the customer as soon as an NI step is marked

The wording for every Northern Ireland step (both directions) is already written into the customer update emails, but those emails only go out on the daily automatic run — so a step marked at 10am isn't communicated until the next day's sweep.

Change: the moment a step is advanced or its date is edited on the Inbound NI tab or the Foam My Bike tab, send that order's update email straight away.

- Applies to inbound steps: collected in Northern Ireland, crossed the ferry, collected from our partner.
- Applies to outbound Foam My Bike steps: at the depot, foam-protected, at the ferry port, crossed to Northern Ireland, delivered in Northern Ireland.
- Sender and receiver both get the update, same wording already in use.
- If the email fails, the step still saves and staff see a small warning — never a blocked status change.
- Stepping a bike backwards does not send anything.

## 2. "Crossed the ferry" badge on the Get Timeslots popup

For bikes coming from Northern Ireland that we then deliver in England, the delivery stop in the timeslot popup will show where the bike physically is, next to the existing collection badge:

- `Crossed ferry - ready` (green) — bike has crossed and/or has been collected from City Air Express, safe to plan the delivery.
- `In NI - not crossed` (red) — still in Northern Ireland or awaiting collection there; this delivery cannot be fulfilled yet.
- `NI - ferry crossed` wording shows the date it crossed where we have it.

The badge only appears on delivery stops of inbound Northern Ireland orders, so nothing changes for normal jobs.

## Technical notes

- `src/components/boxmybike/InboundNiSection.tsx` and `src/components/boxmybike/FoamMyBikeSection.tsx`: after a successful forward stage mutation, call `supabase.functions.invoke('send-order-updates', { body: { orderId } })`. That single-order path already exists, is staff-authorised via `is_internal_staff`, bypasses the quiet-window/one-per-day suppression, and logs to `order_update_log`. No edge function or database change needed.
- `src/pages/JobScheduling.tsx`: add `ni_direction` and `ni_inbound_status` to the `OrderData` interface (the query already selects `*`).
- `src/components/scheduling/RouteBuilder.tsx`: add a small `getNiInboundBadge(orderData)` helper rendered beside `getCollectionStatusBadge` for both the grouped-stop (~line 604) and single-stop delivery badge rows; add `ni_inbound_status` to the fresh-order refetch select (~line 2150) so a reload reflects live status.
- Verify with `bun run build`.
