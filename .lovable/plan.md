# Guaranteed delivery pop-up still refreshes while typing

## Where things stand

The order page's 5-second refresh is already paused while this pop-up is open, so that refresh is probably not the cause. Something else is rebuilding the pop-up. The cause isn't confirmed yet, so step 1 is to find it.

## Plan

1. **Find the cause.** Open the pop-up on an order in the running app, type, and log what changes each time it "refreshes". The likely candidates are:
   - the whole order page briefly going back to its loading state (for example when the sign-in session refreshes), which closes and rebuilds the pop-up
   - the Services panel rebuilding the guaranteed row so the pop-up resets
   - another update path on the page (there are about 20 places that replace the order) firing while the pop-up is open
2. **Fix it so typing can't be lost, whatever the cause:**
   - Store the typed amount, payer, date, note and the open/closed state above the page's loading switch, so a rebuild keeps them.
   - Only show the full-page loading spinner on the first load, never on background reloads.
   - Hold back every background order update while the pop-up is open, not just the 5-second one, and apply it once the pop-up closes.
3. **Re-test** at desktop and phone width: type a full amount, pick who pays, confirm, and check the saved total matches what was typed.

## Technical notes

- `src/pages/OrderDetail.tsx`: `setLoading(true)` in the `[id]` fetch effect, and the `setOrder` calls at lines ~374–978. Route them through one `applyOrderUpdate` that respects `isPollingPaused()`.
- `src/components/order-detail/GuaranteedDeliveryCard.tsx`: move the form state into a small store keyed by order id (module-level or context) so a remount brings it back. Keep `pausePolling`/`resumePolling`.
- Also check `AuthContext` for `loading`/user changes on token refresh that remount the page.
- Nothing changes in the database or invoicing.
