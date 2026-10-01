# Make approved repairs move to the right stage automatically

## What I found
Customer approvals made through the approval link do set a stage, but only once, at the moment they approve. After that, nothing re-checks the stage when parts are marked ordered, arrived or in stock, or when staff approve repairs for the customer. Jobs drift out of step:

- **CCC754262915863STEGL1** and **CCC754191680441HARBN4** are in **Awaiting repair**, but one approved part is still missing. They should be **Awaiting parts**.
- **CCC754109746635MUHIG1** is in **Awaiting repair** with no approved repairs at all. I'll check it and correct it.
- Jobs in **Awaiting parts** only move on when someone moves them by hand, even after every part has arrived.

## The rule (applied everywhere)
Once the customer has answered every repair, and no buyer decision is still outstanding:
- At least one approved repair is still waiting on its part → **Awaiting parts**
- Every approved repair has its part (in stock, or ordered and arrived) → **Awaiting repair**

This is checked again every time a repair is approved or declined, or a part is marked ordered, arrived or in stock. So a bike moves from Awaiting parts to Awaiting repair by itself when the last part arrives, and moves back if a new repair needing a part is added. Later stages (In repair, Cleaning, Repaired, Ship as is) are never pushed backwards. The existing buyer-wait rule still takes priority (Repairs declined / Pending receiver approval).

## Fix existing jobs
Re-run the rule once across all open inspections so the jobs above, and any others, land in the correct stage. Before changing anything, I'll list which jobs will move.

## Technical details
- New database function `recompute_inspection_stage(inspection_id)` uses the same "has part" test as `submit_public_inspection_approval` (`parts_in_stock OR (parts_arrived AND parts_ordered)`). It only changes stage when the current stage is issues_found, awaiting_approval, awaiting_parts or awaiting_repair, and it runs after the buyer-wait guard.
- AFTER INSERT/UPDATE OF status, parts_ordered, parts_arrived, parts_in_stock / DELETE trigger on `inspection_issues` calls it. Recursion is guarded with `pg_trigger_depth()`.
- `submit_public_inspection_approval` and `submit_public_repair_offer` call the same function instead of their own CASE logic. `reconcileInspectionStatuses` in `inspectionService.ts` is simplified to rely on it.
- One-off backfill in the same migration. Receiver-billed repairs count as approved work.
