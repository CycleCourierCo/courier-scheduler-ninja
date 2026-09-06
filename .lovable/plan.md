# Guaranteed delivery amount box resets while typing

## What you're seeing

You open the guaranteed delivery pop-up, start typing an amount, and the pop-up appears to reload — your typing is lost.

## Where things stand

The order page refreshes itself every 5 seconds. Last time, a guard was added so those refreshes are held back while a pop-up is open, and the amount box was switched to a plain text field taking a VAT-inclusive total. That guard is in the code today, so either it hasn't reached the version you're using yet, or something else is clearing the box.

Because I haven't reproduced the problem myself, the first step is to confirm it, not to guess.

## Plan

1. Reproduce it: open a real order in the running app, open the guaranteed delivery pop-up, type an amount, and watch what happens (screenshots, plus any browser errors). Test at phone width, since that's where you saw it.
2. Depending on what the reproduction shows, apply the fix that matches:
   - If refreshes are still getting through: pause the automatic refresh with an explicit switch that turns on when the pop-up opens and off when it closes, instead of relying on detecting an open pop-up in the page.
   - If the pop-up itself is being rebuilt: keep the typed amount, payer and note outside the part that gets rebuilt so they survive a refresh.
   - If it's the keyboard/field behaviour on mobile: keep the field as plain text, avoid re-formatting what you type until you leave the field.
3. Re-test the whole flow: type an amount, pick who pays, confirm, and check the total charged matches what was typed (VAT shown as a breakdown underneath).
4. Publish so the fix is live on the site you use.

## Technical notes

- `src/pages/OrderDetail.tsx` polls `pollOrderUpdates(order.id, …, 5000)` and currently detects open dialogs via `document.querySelector('[role="dialog"][data-state="open"]')`, queuing skipped updates in `pendingOrderRef` and flushing them on a 1s interval. Replace the DOM sniffing with a ref/state flag set by the dialog's `onOpenChange` (passed down or via a small context) so the pause is deterministic.
- `src/components/order-detail/GuaranteedDeliveryCard.tsx` already holds `amount` as string state with gross→net conversion (`round(gross / 1.2, 2)`) before calling `setGuaranteedDelivery`. If the card is remounting, hoist the dialog out of `AccordionContent` in `OrderServicesPanel.tsx` or memoize the card so parent prop churn can't reset it.
- No database or edge-function changes; QuickBooks continues to receive the net amount plus VAT code.
