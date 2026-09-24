# Wait for the buyer before moving part-approved repairs to Awaiting Repair

## What went wrong
On CCC754955533653MUHAL4 the account approved 1 repair (gear cable) and declined 3. You offered the 3 declined repairs to the buyer. The stage then jumped to Awaiting Repair because the system saw "there is approved work to do" and treated that as more important than "the buyer still needs to answer". It is showing as Pending receiver approval now, but the same rule can push it forward again the next time the page refreshes.

## New rule
If any declined repair still needs sending to the buyer, or is waiting for the buyer's answer, the job stays in **Repairs declined** / **Pending receiver approval**, even when some repairs were approved. It moves to Awaiting Parts / Awaiting Repair only when the buyer has approved or declined every offered repair (or staff record it for them).

The same rule applies in all three places that change the stage:
- the workshop page's automatic stage check
- the account's public approval page (a partial approval currently goes straight to Awaiting Repair)
- the buyer's repair-offer page (so the job moves on once the buyer answers)

## Technical details
- `src/services/inspectionService.ts` `reconcileInspectionStatuses`: in the `issues_found` and `repairs_declined`/`pending_receiver_approval` branches, check `declinedNotOffered` then `declinedOffered` before `outstandingApproved`. Workshop-only inspections, and approvals already sent to the receiver or walk-in, have no onward buyer step, so they keep going straight to the post-approval stage. This matches the existing Repairs Declined exclusion.
- Migration: update `submit_public_inspection_approval` so that if some repairs are declined on an eligible transport job, the job goes to `repairs_declined` instead of `awaiting_repair`. Also update `submit_public_repair_offer`'s loop so declined-offered issues count before approved work.
- No data change is needed for this order. It is already `pending_receiver_approval`.
