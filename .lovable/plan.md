# Move the bay "X" to the far right of each storage card

## What changes

On the Loading page's "Bikes in storage" cards, the X button currently sits attached to the right of the bay badge. Replace it with **one single X button at the far right end of the card header row** — the opposite side of the card from the bay badge(s) and customer name, after the status/driver badges, vertically centred on desktop and at the end of the stacked row on mobile.

File: `src/components/loading/BikesInStorage.tsx`

- Remove the X from the `BayBadge` component, leaving the badge as a normal standalone badge (restore full rounding/border).
- Add one icon X button at the end of the card header row (`justify-between` already splits left/right on desktop): small quiet icon button (`h-6 w-6`, muted, hover to destructive), `aria-label`/`title` "Remove from bay".
- Clicking it opens the same destructive confirmation as before:
  - Single-bike order: names the bay, customer, and bike (unchanged).
  - Multi-bike order: clears **all** bay positions for that order in one action; the confirmation names every bay being cleared.
- Same behaviour on confirm: removes the allocation(s) from `orders.storage_locations`; last allocation clears the field. Bike stays on the order and can be re-allocated.

## What does not change

- Badges, collapsible card behaviour, edit/load/label buttons, or any other loading-page logic.

## Verification

- Typecheck with `bunx tsgo --noEmit -p tsconfig.json`.
- Playwright screenshot of the storage cards (single-bike and multi-bike) to confirm the single X appears at the far right of each card.
