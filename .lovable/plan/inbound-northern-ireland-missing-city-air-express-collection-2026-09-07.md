# Inbound Northern Ireland: missing City Air Express collections and stale statuses

## What I checked

Both example orders are recorded as inbound Northern Ireland (`ni_direction = inbound`), both sit at ferry stage "crossed ferry", and both already carry a Shipday collection and delivery reference:

- `CCC754621940862RUATN2` — booked 28 Aug, sender BT31, receiver TN24, Shipday collection 52444854, delivery 52444855.
- `CCC754872802020GORCV3` — booked 1 Sep, sender BT7, receiver CV37, Shipday collection 52650792, delivery 52650794.

So the difference between them is not a missing reference — the reference exists in both cases. Two things are confirmed in the code:

1. A Shipday job is written **once**, at booking, from the addresses as they stood at that moment. Nothing later rewrites an existing job. Scheduling only offers "add to Shipday" when no reference exists, so a job created against the Northern Irish sender address (rather than the City Air Express hand-off) is never corrected and still looks "on Shipday".
2. When a Shipday job completes, the code decides whether it was a ferry hand-off by looking **only at the receiver address / the Northern Ireland flag**, ignoring direction. For an inbound order that is wrong on both legs.

Which of the two is true for `RUATN2` (a job pointing at the BT31 address, or a job that no longer exists in Shipday at all) is not yet confirmed — that is step 1 below.

## Step 1: confirm the state of the two jobs

Read both collection jobs back from Shipday and compare the stored address against the City Air Express hand-off address. This tells us whether the job is missing or simply pointing at the wrong place, and how many other inbound orders are in the same state.

## Step 2: make the collection stop always be City Air Express for inbound orders

Target behaviour on the job scheduler: every inbound Northern Ireland order shows its collection card as "Ferry hand-off — Unit 1 Ordinal Street, Trafford Park, Manchester, M17 1GB" with a green Shipday tick, exactly as `GORCV3` does today, and the delivery card stays the mainland customer.

- Treat an inbound collection job whose address is not the hand-off point as wrong, not as done. Scheduling and dispatch show it as needing attention, with a control to replace it (delete the wrong job, create the correct one) instead of hiding it because a reference exists.
- Extend the existing reconciliation job so it detects inbound collections pointing at a Northern Irish address and repairs them, without creating duplicates.
- Repair the affected orders, starting with `CCC754621940862RUATN2`, so it appears on the scheduler like `GORCV3`.


## Step 3: statuses must always move when a Shipday job is completed

Make the Shipday status handling direction-aware:

Inbound (bike travels Northern Ireland to mainland)
- Collection completed at City Air Express: order becomes collected, ferry stage advances to "collected from partner" with its timestamp, and the order enters the normal mainland flow. Today this leg leaves the ferry stage stuck at "crossed ferry".
- Delivery completed: order becomes fully delivered and the customer gets the normal delivery confirmation. Today an inbound delivery is wrongly treated as a ferry hand-off, so the order never shows as delivered and a ferry email can be sent to a mainland customer.

Outbound (mainland to Northern Ireland)
- Unchanged: delivery completes as the ferry hand-off, collection completes normally.

The same direction-aware rules go into the reconciliation job so a webhook Shipday never sent is still caught, and stages are only ever moved forward, never backward.

## Step 4: verify

- Replay a completed inbound collection and a completed inbound delivery and confirm the order status, the collected/delivered flags and the ferry stage all move correctly, and that no ferry email goes to a mainland receiver.
- Re-run reconciliation twice and confirm it creates no duplicate Shipday jobs.
- Confirm the repaired orders show the City Air Express collection in Shipday and on the planner.

## Technical notes

- Files: `supabase/functions/shipday-webhook/index.ts`, `supabase/functions/reconcile-shipday-orders/index.ts`, `supabase/functions/create-shipday-order/index.ts` (idempotent replace path), `supabase/functions/verify-shipday-orders/index.ts`, `src/components/scheduling/RouteBuilder.tsx`, `src/services/shipdayService.ts`.
- Direction comes from `niDirectionOf` / `resolveNiDirection` in `_shared/northernIreland.ts`; the ferry leg test is `pickup` for inbound and `delivery` for outbound, mirroring `src/utils/niDelivery.ts`.
- Ferry stage columns: `ni_inbound_status`, `ni_inbound_received_at` (set on "collected from partner"), matching `InboundNiSection`.
- Shipday reference writes keep going through `apply_shipday_tracking` so concurrent webhook writes cannot drop ids or history.
- No schema change is expected; all needed columns already exist.
