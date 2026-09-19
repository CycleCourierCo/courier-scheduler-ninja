# Fix: Order detail contact cards unreadable in dark mode

## Problem
The sender/receiver contact cards on the order detail page stay white in dark mode while the text inside them becomes near-invisible light gray. The cause is hardcoded light-theme gray classes (`bg-gray-50`, `text-gray-500/800`, `border-gray-200`) that ignore the dark-mode theme.

## Fix
Replace hardcoded gray classes with the app's semantic theme tokens, which already adapt between light and dark mode:

- `bg-gray-50` / `bg-gray-100` (card backgrounds) → `bg-muted`
- `text-gray-800` / `text-gray-900` (headings/names) → `text-foreground`
- `text-gray-500` / `text-gray-600` / `text-gray-700` (secondary text, icons) → `text-muted-foreground`
- `border-gray-200` → `border-border`

Light mode appearance stays visually identical; dark mode becomes readable.

## Files to change (11, ~18 class swaps total)
- `src/components/order-detail/ContactDetails.tsx` — the card in the screenshot (main fix)
- `src/components/order-detail/AdminContactEditor.tsx`
- `src/components/order-detail/SchedulingButtons.tsx`
- `src/components/order-detail/EmailDeliveryStatus.tsx`
- `src/components/EmptyOrdersState.tsx`
- `src/pages/TrunkRunsPage.tsx`
- `src/pages/InvoicesPage.tsx`
- `src/pages/AccountApprovals.tsx`
- `src/components/analytics/CustomerTypeChart.tsx`
- `src/components/scheduling/BulkRouteMessageDialog.tsx`
- `src/components/scheduling/RouteBuilder.tsx` (1 occurrence)

`src/components/ui/sidebar.tsx` and `src/App.css` also contain gray classes but are part of the base UI kit; will only touch them if they visibly break dark mode in the same way.

## Verify
- Typecheck/build passes.
- Toggle dark mode on the order detail page: contact name, email, phone, address and notes readable; buttons unchanged.
- Spot-check light mode: appearance unchanged.
