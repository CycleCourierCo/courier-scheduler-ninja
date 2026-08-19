# Add service badges to mobile order cards

## What changes
Extend `src/components/OrderCardList.tsx` to show small service/add-on badges on each mobile order card:

- **NI** — when `order.isNorthernIreland` is true.
- **Guaranteed** — when `order.guaranteedDelivery` is true.
- **Box** — when `order.isBoxMyBike` is true.
- **Inspect** — when `order.needsInspection` is true.

The badges will sit as a compact row between the status badge and the sender→receiver line, using the existing `Badge` component and semantic colour tokens. They will be small enough not to push the card height, and will wrap if several apply.

No data-fetch changes are needed because `getOrdersWithFilters` already selects all columns and `mapDbOrderToOrderType` already maps these four fields.

## Verify
At 360px width, cards with any of these add-ons show the relevant badge(s), cards without them stay unchanged, and the layout does not overflow or wrap awkwardly.
