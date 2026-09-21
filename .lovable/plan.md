# Add a card-level X on the right side of each storage card

## What changes

On the Loading page's "Bikes in storage" cards, each bay badge already has an X on its right — that stays exactly as it is. Add a **second X button at the far right end of the card header row** (opposite side of the card, after the status/driver badges, vertically centred on desktop; end of the stacked row on mobile).

File: `src/components/loading/BikesInStorage.tsx`

- Add the X button inside the card header, at the end of the existing flex row (`justify-between` already splits left/right on desktop).
- Style it as a small, quiet icon button (`h-6 w-6`, muted, hover to destructive), with `aria-label` / `title` "Remove from bay".
- Clicking it opens the same destructive confirmation as the badge X:
  - Single-bike order: names the bay, customer, and bike (same as today).
  - Multi-bike order: clears **all** bay positions for that order in one action; the confirmation names every bay being cleared.
- Same behaviour on confirm: removes the allocation(s) from `orders.storage_locations`; last allocation clears the field. Bike stays on the order and is re-allocatable.

## What does not change

- The existing X beside each bay badge and its per-bike confirmation.
- Collapsible card behaviour, edit/load/label buttons, or any other loading-page logic.

## Verification

- Typecheck with `bunx tsgo --noEmit -p tsconfig.json`.
- Playwright screenshot of the storage cards (single-bike and multi-bike) to confirm the X appears at the far right of each card.
