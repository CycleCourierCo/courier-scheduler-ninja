# Service-before-packing gate for Box My Bike and Foam My Bike

Today the inspection/service pipeline and the packing pipelines run independently. A bike that still needs servicing can be advanced to "Boxed, awaiting label" or foamed and sent to the ferry, because neither the Box My Bike page nor the Foam My Bike section looks at inspection state. The only thing service currently blocks is the receiver availability email.

This adds a hard gate so packing can't start until the workshop has finished service **and** cleaning.

## Rule

For an order with `needs_inspection = true`, service is "complete" only when its inspection reaches `repaired`. Anything earlier — `pending`, `inspected`, `awaiting_pricing`, `issues_found`, `awaiting_parts`, `awaiting_repair`, `in_repair`, `cleaning` — counts as outstanding.

Note: a no-issues bike currently stops at `inspected`, and the existing workflow already pushes it on through `cleaning` to `repaired`, so the "clean it anyway" path still satisfies the gate.

Orders without `needs_inspection` are unaffected and behave exactly as now.

## Box My Bike

Blocked transition: advancing out of `in_depot_awaiting_boxing` into `boxed_awaiting_label` (boxing is the packing step).

- Stage-advance button is disabled while service is outstanding, with a tooltip naming the current inspection stage.
- Card shows a "Service outstanding — {stage}" badge alongside the existing location badge.
- Backward moves and later stages (label, 3rd-party collection) stay available.

## Foam My Bike

Blocked transition: advancing out of `pending_foaming` into `foamed_ready`.

- Same disabled button, tooltip, and badge treatment.
- Downstream ferry/NI stages remain reachable once foaming has happened.

## Admin override

An admin (only `admin` role) sees an "Override" option on a blocked stage button. It opens a small dialog requiring a typed reason, then:

- performs the stage change,
- writes an order comment recording who overrode, the inspection stage at the time, and the reason.

Mechanics and loaders get no override — the button is simply disabled for them.

## Technical notes

- Fetch inspection state alongside the packing queries: add `needs_inspection` to the `orders` selects in `src/pages/BoxMyBikePage.tsx` and `src/components/boxmybike/FoamMyBikeSection.tsx`, and load matching rows from `bicycle_inspections` (`order_id`, `status`) for the visible order ids.
- New shared helper `src/utils/servicingGate.ts` exporting `isServiceComplete(needsInspection, inspectionStatus)` and `serviceGateLabel(inspectionStatus)` so both surfaces apply identical logic.
- Gate is enforced in the `updateStage` mutation as well as in the button's disabled state, so a stale UI can't slip a change through.
- Override audit uses the existing `order_comments` table — no schema changes needed.
- No database migration required.
