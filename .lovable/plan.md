# Guaranteed delivery pop up: fix the amount box, and enter amounts including VAT

## 1. The amount box resets while typing

The order page reloads the order from the server every 5 seconds (`pollOrderUpdates` in `src/pages/OrderDetail.tsx`, line 301) and always stores the freshly fetched order, even when nothing has changed. Every one of those refreshes re-renders the whole order page, including the open pop up — the likely reason the field loses focus, the keyboard closes and you can't continue typing. This cause isn't proven yet, so the first step is to reproduce it before changing behaviour.

Steps:

1. Reproduce: open an order as admin at phone width, open Guaranteed delivery, type an amount and watch what happens on the 5-second boundary (focus loss, value reset, or the pop up closing).
2. Stop needless refreshes: only apply a polled update when the order data has actually changed.
3. Pause refreshing while a pop up is open, applying the pending update once it closes, so nothing changes under the user's fingers.
4. Make the field forgiving: keep the typed text as-is while editing (empty box or a partial "1." allowed), converting to a number only on Confirm.

## 2. Amounts are entered including VAT

Today the figure typed is treated as excluding VAT and 20% is added on the QuickBooks invoice. Change it so staff type the total the customer pays.

- The field is relabelled "Total amount to charge (£, incl. VAT)".
- Under the box, a live line shows the breakdown, e.g. "£120.00 total = £100.00 + £20.00 VAT".
- On confirm, the VAT-exclusive figure is what gets stored and sent to QuickBooks, so the invoice total matches the number typed exactly.
- The confirmation card and toasts show the total including VAT, with the excluding-VAT figure noted underneath.
- Existing guarantees already saved keep their stored figure; nothing is rewritten. Editing one pre-fills the box with the VAT-inclusive equivalent.

## Technical notes

- `src/pages/OrderDetail.tsx` — skip `setOrder` when the polled order is deep-equal to the current one; add a modal-open guard (ref set from a `[role="dialog"]` presence check) and flush the last pending order when it clears.
- `src/components/order-detail/GuaranteedDeliveryCard.tsx` — amount stays a controlled string; on Confirm compute `net = round(gross / 1.2, 2)` and pass net to `setGuaranteedDelivery`; display `gross = net * 1.2` in the summary and when pre-filling Edit. Keep the "greater than £0" rule for sender/receiver invoices.
- Invoice side unchanged: `create-guaranteed-delivery-invoice` and the weekly `create-quickbooks-invoice` line both already use the stored amount as the net unit price with the VAT tax code, so no edge function or database changes are needed.
