# Two new inspection stages for declined repairs

Today an inspection jumps straight from "Issues Found" to Awaiting Parts / Awaiting Repair (or Repaired if everything was declined). There is no visible stage telling the workshop "the customer declined some work — this needs offering to the receiver", and no stage showing "we've offered it, waiting on the receiver".

## New stages

Added to the inspection pipeline, straight after Issues Found:

1. **Declined — offer to receiver** (`repairs_declined`)
   Reached automatically when the customer has responded to every repair and at least one repair is declined (fully or partly declined) and has not yet been offered to the receiver.

2. **Pending receiver approval** (`pending_receiver_approval`)
   Reached as soon as the declined repairs are offered to the receiver (via the existing "Offer declined repairs to receiver" action, or the staff-recorded equivalent).

Both get their own tab on the Bicycle Inspections page with a count, and their own status badge (amber). They also appear in the admin "Change status" override dropdown.

## How bikes move on

- Customer approves everything → unchanged: Awaiting Parts, or straight to Awaiting Repair when all parts are in stock.
- Some/all declined → **Declined — offer to receiver**.
- Offer sent → **Pending receiver approval**.
- Receiver approves any repair → moves into **Awaiting Repair** if every outstanding approved repair already has parts in stock, otherwise **Awaiting Parts** (same rule as the customer path, so parts ordering and repair completion behave identically).
- Receiver declines everything (and nothing else is outstanding) → **Repaired** (service complete), which also triggers the deferred receiver-availability email exactly as now.
- If a bike has approved customer repairs *and* declined ones, the approved work still progresses normally; the declined-offer stage is only used when there is no other outstanding approved work to do. Approved work is never held up waiting on a receiver decision.

Nothing changes for the customer-facing tracking wording: both new stages read as "our mechanics found a few things worth doing" to the booking customer, so no receiver pricing detail leaks.

## Technical notes

- `bicycle_inspections.status` is a plain text column with no check constraint, so no migration is needed. Add `repairs_declined` and `pending_receiver_approval` to `InspectionStatus` in `src/types/inspection.ts`.
- `src/services/inspectionService.ts` → `reconcileInspectionStatuses`:
  - Widen the status filter to include the two new stages.
  - Compute `declinedNotOffered` / `declinedOffered` from `inspection_issues` (`status`, `offered_to_receiver_at`, `receiver_approved_at`, `receiver_declined_at`, `billing_party`).
  - Replace the single `issues_found && allResponded` branch with the routing described above, and add transitions out of `repairs_declined` (→ `pending_receiver_approval` once offered, → parts/repair once receiver-approved) and out of `pending_receiver_approval` (→ awaiting_parts / awaiting_repair / repaired).
  - Select the extra issue columns in the reconcile query.
- `offerDeclinedRepairsToReceiver` and `markIssueReceiverApproved` / `undoReceiverApproval` call the reconcile path so the stage updates immediately after the action.
- `src/pages/BicycleInspections.tsx`: two entries in `getInspectionBadge`, two filtered lists, two `TabsTrigger`/`TabsContent` blocks (between Issues and Awaiting Parts), two `SelectItem`s in the admin override, and include the new stages in the "post-approval"/awaiting checks where they behave like `issues_found`.
- `src/utils/servicingGate.ts`: labels for both stages; service is still only complete at `repaired`, so packing gates are unaffected.
- `src/hooks/useInspectionStages.ts`: add both to `STAGE_RANK` between `issues_found` and `awaiting_parts`.
- `supabase/functions/send-order-updates/index.ts`: map both new stages onto the existing `in_depot_issues_found` customer message (redeploy the function).
