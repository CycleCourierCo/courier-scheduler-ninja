# Send fully declined bikes to Awaiting repair

When the account declines repairs and the buyer then declines every offered repair as well, the bike will go to **Awaiting repair** instead of **Ship as-is**, so a mechanic finishes it (clean/check) before it's released.

## Behaviour
- Account approved some + buyer declined the rest: unchanged (Awaiting parts / Awaiting repair).
- Account declined all + buyer declined all: **Awaiting repair** (was Ship as-is).
- Account declines everything and the repairs are never offered to a buyer, or the job is workshop-only / direct-to-receiver: unchanged.
- The mechanic then moves it on through cleaning to Service complete as normal, which unlocks the buyer's delivery dates.

## Technical details
- New migration updating the two stage decisions in the receiver-response function and the reconciler (`WHEN v_declined > 0 THEN 'ship_as_is'` and the `v_next := 'ship_as_is'` branch): when declined issues were offered to the receiver and all are `receiver_declined_at`, choose `awaiting_repair`.
- Align the workshop page reconciler in `BicycleInspections.tsx`/`inspectionService.ts` with the same rule so it doesn't flip the stage back.
- Check existing inspections currently at `ship_as_is` where the buyer declined everything and move them to `awaiting_repair` (listed before changing).
