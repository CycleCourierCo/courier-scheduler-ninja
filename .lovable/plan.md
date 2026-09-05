# Fix: amount box on the Guaranteed delivery pop up resets while typing

## What's happening

The order page reloads the order from the server every 5 seconds (`pollOrderUpdates` in `src/pages/OrderDetail.tsx`, line 301) and always stores the freshly fetched order, even when nothing has changed. Every one of those refreshes re-renders the whole order page, including the open Guaranteed delivery pop up.

The most likely consequence is that the pop up regains focus on each refresh, so the amount field loses focus, the phone keyboard closes and the digits you typed can't be continued — which matches "the whole pop up just refreshes". This cause is not yet proven, so the first step is to reproduce it on the live page before changing behaviour.

## Plan

1. Reproduce: open an order as admin on a phone-sized view, open Guaranteed delivery, start typing an amount, and watch what happens on the 5-second boundary (focus loss, value reset, or the pop up closing). Confirm the refresh is the trigger.
2. Stop needless refreshes: only apply a polled update when the order data has actually changed (compare the fetched order against the one already held; skip the state update when identical).
3. Pause refreshing while a dialog is open: while any pop up is on screen, hold back polled updates and apply them once it closes, so nothing under the user's fingers changes mid-edit.
4. Make the amount field forgiving regardless: keep the typed text as-is while editing (allow an empty box and a partial number like "1." without snapping back), only converting to a number on Confirm.
5. Re-test the same flow: type an amount over more than 10 seconds, add a note, confirm, and check the amount saved is the one typed.

## Technical notes

- `src/pages/OrderDetail.tsx` — in the `pollOrderUpdates` callback, skip `setOrder` when the payload is deep-equal to current order; add a modal-open guard (track open state via a ref set from a `[role="dialog"]` presence check or a small context flag) and flush the last pending order when it clears.
- `src/components/order-detail/GuaranteedDeliveryCard.tsx` — amount stays a controlled string, no coercion on change; validate on Confirm as it already does. Reset the field when the dialog opens rather than on every render.
- Presentation/state only: no database, edge function, or invoicing logic changes.
