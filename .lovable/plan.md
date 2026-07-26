## Problem

For order `CCC754409051458PEEHP4`, the final repair was resolved and the inspection flipped to `repaired` on **2026-07-24 15:14**, but the receiver-availability email did not go out until **2026-07-26 12:35** (whatever nudged the order into an allowed status at that point). It should have gone at the moment of repair.

## Root cause

`triggerReceiverAvailabilityIfDeferred` in `src/services/inspectionService.ts` (lines 41–78) short-circuits unless the order's status is one of:

```ts
['sender_availability_confirmed', 'receiver_availability_pending']
```

By the time inspection actually completes, orders are almost always further along — the DB shows the vast majority of inspected/repaired/cleaning bikes sitting in `collected` (or `delivered`, `scheduled_dates_pending`, etc.). So every deferred handoff from `moveToRepaired` / `markAsInspected` / the cleaning auto-promote falls through the guard and no email is sent. The receiver only gets the email if some other action later happens to nudge status back through `sender_availability_confirmed` / `receiver_availability_pending`.

The other two guards in that function are already sufficient on their own:
- `needs_inspection = true` (this handoff only exists for inspection orders)
- `delivery_date` is empty / not-array (idempotency — receiver hasn't picked dates yet)

## Fix

Drop the order-status allowlist in `triggerReceiverAvailabilityIfDeferred`. Keep the `needs_inspection` and "receiver hasn't picked dates" guards, which together already give correct idempotency and scope.

Also update the pre-send status write so we don't clobber a more-advanced status like `collected`:

- If current status is one of `sender_availability_confirmed` or `receiver_availability_pending`, set it to `receiver_availability_pending` (existing behaviour — just formalised).
- Otherwise (`collected`, `at_depot`, etc.), leave the order status untouched and only send the email. The bike is physically further along than the availability step, so overwriting status backwards would be wrong.

### File to change

`src/services/inspectionService.ts` — `triggerReceiverAvailabilityIfDeferred` (lines 41–78):

1. Remove the `if (!['sender_availability_confirmed', 'receiver_availability_pending'].includes(order.status)) return;` line.
2. Wrap the `orders.update({ status: 'receiver_availability_pending', ... })` call in a conditional that only runs when the current status is one of those two values; otherwise skip the status write entirely.
3. Always call `resendReceiverAvailabilityEmail(order.id)` when `needs_inspection = true` and `delivery_date` is empty.

No schema changes. No changes to `moveToRepaired`, `markAsInspected`, `setInspectionCleaningTask`, or `reconcileInspectionStatuses` — they already call the helper at the right moments; only the helper's gate is wrong.

## Verification

- Manually re-run the helper against a stuck order (query for `needs_inspection = true`, empty `delivery_date`, inspection.status in (`repaired`,`inspected`)) and confirm the email fires.
- Check `email_delivery_events` afterwards for a fresh `receiver_availability` `sent` row.
- Confirm idempotency: calling the helper twice in a row after the first send would still be gated by `hasReceiverDates` once the receiver submits, so we won't spam.

## Optional follow-up (not in this change unless you want it)

There are likely other orders currently stuck in the same way (repaired but no receiver email). A one-off backfill script could iterate them and call the helper. Say the word and I'll add it as a second step.
