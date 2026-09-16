# Show work address / neighbour choices on the order

## What's missing today

When a sender or receiver sets their availability, they can also add:
- a neighbour's house number ("deliver to number 12 if I'm out"), and
- a workplace address with the days and times it can be used.

Those answers are saved and are already used by Job Scheduling when picking the actual stop address, but nothing on the order page shows them. Staff and customers looking at an order can't see that a work address or neighbour was chosen.

## What changes

On the order page, inside the Sender and Receiver blocks, show a clearly marked "Alternative collection details" / "Alternative delivery details" section whenever the customer gave one:

- **Work address** — the full address, plus which of their chosen dates it applies to and the time window for each (for example "Wed 23 Sep, 09:00-17:00"). Older orders that only recorded weekdays show those instead.
- **Neighbour** — "Can be left with neighbour at number 12".
- A small badge on the sender/receiver block ("Work address", "Neighbour") so it's obvious at a glance without scrolling.

The same details appear on the customer's own order page, read-only, so they can check what they submitted.

Nothing is added when the customer didn't provide anything, and nothing changes about how the details are captured, stored, or used for routing.

## Technical notes

- Data lives in `orders.sender_alt_location` / `orders.receiver_alt_location` (JSONB). Order queries already use `select("*")`, so no query or database changes.
- `src/types/order.ts`: add `senderAltLocation` / `receiverAltLocation` typed as `AltLocation | null`; map them in `src/services/orderServiceUtils.ts` via the existing `parseAltLocation` helper from `src/lib/altLocation.ts`.
- New presentational component `src/components/order-detail/AltLocationDetails.tsx` rendering address + date windows, reusing `formatAltAddress`, `hasWorkAddress`, `describeWindows` and `DAY_LABELS` from `src/lib/altLocation.ts`.
- Render it in `src/components/order-detail/ContactDetails.tsx` (staff page, both sides) and in the sender/receiver sections of `src/pages/CustomerOrderDetail.tsx`.
- No migration, no edge function, no RLS changes.
