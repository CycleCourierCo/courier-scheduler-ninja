# Collection readiness score

Give every order a 0–100 "ready for collection" score based on how complete its data is, so planners can spot problem jobs before a driver is sent out.

## What the score measures

Each order is checked against a set of weighted readiness checks, all derived from data already on the order:

| Check | Weight | Passes when |
| --- | --- | --- |
| Sender contact | 15 | Sender name, email and phone all present |
| Receiver contact | 15 | Receiver name, email and phone all present |
| Collection address | 15 | Street, city and postcode present |
| Address geocoded | 15 | Sender address has lat and lon |
| Delivery address | 10 | Receiver street, city and postcode present |
| Bike details | 10 | Every bike has a brand, model and type |
| Bike value | 5 | At least one bike has a value (needed for insurance) |
| Collection availability | 10 | Sender has confirmed dates (or the order is already scheduled) |
| Payment details | 5 | If payment on collection is required, a payment phone is set (auto-pass otherwise) |
| Instructions | 5 | Delivery instructions or notes provided (auto-pass when a collection code exists) |

Score = sum of passed weights, capped at 100. Bands:

- **90–100 Ready** — green
- **60–89 Almost ready** — amber
- **Below 60 Not ready** — red

Checks that don't apply to an order (e.g. payment phone when no payment is needed) pass automatically so scores stay comparable.

## Where it shows

1. **Order cards (dashboard/order list)** — a compact circular progress ring with the number, colour-coded by band, next to the status badge. Tapping/hovering it shows which checks are failing.
2. **Order detail page** — a "Collection readiness" card listing every check with a tick or cross, the failing reason, and the total score, placed near the top of the admin view.
3. **Order filters** — an optional "Readiness" filter so staff can list only orders scoring under a threshold ("needs attention").

Staff-only: customers and B2B accounts don't see the ring or card.

## Technical notes

- New `src/utils/collectionReadiness.ts` exporting:
  - `type ReadinessCheck = { id, label, weight, passed, reason?, applicable }`
  - `type ReadinessResult = { score, band, checks, failing }`
  - `calculateCollectionReadiness(order: Order): ReadinessResult` — pure function, no DB or network access, using existing `Order` fields (`sender`/`receiver` contact + address incl. `lat`/`lon`, `bikes`, `bikeValue`, `pickupDate`, `scheduledPickupDate`, `senderConfirmedAt`, `needsPaymentOnCollection`, `paymentCollectionPhone`, `deliveryInstructions`, `senderNotes`, `collectionCode`).
- New `src/components/orders/CollectionReadinessRing.tsx` — small SVG ring (no new dependency) with the score inside, wrapped in a `Popover` (tap on mobile, hover on desktop) listing failing checks. Colours come from semantic tokens, not hardcoded utilities.
- New `src/components/order-detail/CollectionReadinessCard.tsx` — full checklist view using the same result object.
- `src/components/OrderCardList.tsx` — render the ring for staff roles only (`admin`, `route_planner`), in the header row beside `StatusBadge`.
- `src/pages/OrderDetail.tsx` — render the readiness card in the admin layout.
- `src/components/OrderFilters.tsx` — add a readiness select ("Any", "Needs attention < 60", "Almost ready < 90"), filtering client-side with the same helper.

No database migration or service change: the score is computed from data already loaded with each order.
