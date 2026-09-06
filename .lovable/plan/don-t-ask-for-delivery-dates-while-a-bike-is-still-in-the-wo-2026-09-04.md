# Don't ask for delivery dates while a bike is still in the workshop

Goal: the receiver is only asked for delivery dates once the workshop has fully finished the bike. Until then they still get depot/workshop progress updates, just no date requests or reminders.

## What changes

1. "Finished" now means one thing only: the bike has reached the final workshop stage (service complete). Being inspected but not yet through repairs/cleaning no longer counts as finished, so no date request goes out at that point.
2. On orders with more than one bike, every bike must be finished before the receiver is asked. Today a single finished bike is enough to release the request, which is why chasers went out while other bikes were still being worked on.
3. The automatic date request and the every-2-day reminder emails both follow the same rule, so they can't disagree.
4. Once the last bike is finished, the delivery-dates email fires as it does today.

## Technical detail

- `src/services/inspectionService.ts` → `isReceiverAvailabilityBlockedByInspection`: complete = an inspection row with `status === 'repaired'`; change the `.some()` check to "there is at least one inspection row and every row is `repaired`". Drop `'inspected'` from the accepted set.
- Deferred trigger: `triggerReceiverAvailabilityIfDeferred` keeps its current call sites (it already re-checks the block), so it will only release once the whole order is `repaired`. Verify the `markAsInspected` / cleaning-completion call paths still route through the same check.
- `supabase/functions/send-order-updates/index.ts` (lines ~626-650): build `inspectionComplete` the same way — group fetched `bicycle_inspections` rows by `order_id` and mark the order complete only when it has rows and all are `repaired`. `isInspectionPending` then guards the `awaiting_receiver_dates` push as it does now.
- No database or UI changes; the `in_depot` / workshop-stage updates stay exactly as they are so the receiver still hears from us.
