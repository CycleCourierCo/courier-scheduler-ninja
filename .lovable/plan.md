# Open order from Expiring Dates

## What it does

Each card on the Expiring Dates page gets a small "open order" icon button (ExternalLink icon) in its header, next to the tracking number and leg badge. Clicking it opens that order's staff page (`/orders/{orderId}`) in a new browser tab, so the current page stays as it is — no navigation away from the watch list.

The same button appears on cards in all four columns (today / tomorrow / 2–3 days / expired) and on the map popups' underlying data is untouched — the map keeps working as before. Order access stays governed by the existing order-detail permissions.

## Technical changes

**`src/pages/ExpiringDatesPage.tsx`** only.

- In the card header row, add an anchor:
  `<a href={`/orders/${leg.orderId}`} target="_blank" rel="noopener noreferrer">` wrapping an `ExternalLink` icon (lucide-react), with `aria-label="Open order in new tab"` and a `title` tooltip.
- Placed on the right side of the header, after the Collection/Delivery badge; keep the existing layout intact.
- No data changes, no new queries — `orderId` is already on every leg.

## Verification

- TypeScript check passes.
- Preview: cards show the icon, and the link resolves to the order page route (already defined, `/orders/` prefix).
