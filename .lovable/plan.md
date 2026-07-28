## Goal

Multiple Northern Ireland deliveries on one route currently show as separate stops (#1, #2 …) at the ferry hand-off address. They should bundle into a single multi-job stop, and all messaging for that stop must go to the ferry hand-off contact you supplied — never the Northern Ireland receiver.

## Why they aren't bundling

`groupJobsByLocation` in `src/components/scheduling/RouteBuilder.tsx` merges stops only when coordinates match **and** the contact key matches. The contact key is built from `orderData.receiver.email` / phone — the NI end customer, different for every order — so the merge is refused even though both stops resolve to the same ferry coordinates.

## Contact details used

The ferry hand-off contact is already the single source of truth in `src/constants/depot.ts` and is returned by `getLegContact(order, 'delivery')` for NI orders:

- Name shown on the stop: Ferry hand-off
- Email: the operations address stored in that constant
- Phone: the mobile number stored in that constant
- Address: Unit 1 Ordinal Street, Trafford Park, Manchester, M17 1GB

The NI receiver's name and address remain visible only as the "Final destination:" reference line on the card. `send-timeslot-whatsapp` already redirects the WhatsApp and email for NI delivery legs to this hand-off contact — the grouped send will reuse that same path, so no receiver contact is ever used.

## Change

1. In `RouteBuilder.tsx`, change `getContactKey` so a delivery leg on a Northern Ireland order (detected with the existing `isNiOrder` helper) returns one shared key derived from the ferry hand-off contact instead of the receiver's email/phone.
2. With the key shared, the existing location + contact merge groups all NI delivery legs at the ferry coordinates into one stop card: one arrival time, each job listed beneath with customer name, bike count, badges and its final destination line, and one grouped SendZen button.
3. Verify the grouped send path passes the ferry hand-off email/phone for every job in the group (it resolves per-order through the NI branch in `send-timeslot-whatsapp`), and that no NI receiver email/phone is used for the stop.
4. Pickups and non-NI deliveries keep their current per-contact key, so nothing else regroups.

## Behaviour after the change

- One "Ferry hand-off" stop containing all NI jobs, single arrival time, travel time counted once.
- One Send action, messaging only the hand-off operations email and mobile.
- Removing the stop removes all jobs in the group (existing group-removal logic).

## Technical notes

- Main edit: `src/components/scheduling/RouteBuilder.tsx` (`getContactKey`), importing `isNiOrder` / `getLegContact` from `@/utils/niDelivery`.
- No database changes; saved routes and timeslip mileage already resolve NI stops via `resolveStopCoords`.
