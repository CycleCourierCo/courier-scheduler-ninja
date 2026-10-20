# CCC754521497045WILPO4: tracking says "repairs approved" while 3 repairs are still undecided

## What the records show
- The inspection on 2 Oct found 5 repairs, and the approval went to the account holder.
- On 8 Oct at 12:41 (London time), 2 repairs were approved, 12 seconds apart: the rear cable (£30) and the chain (£30).
- The other 3 have no answer yet: rear pads (£35), rear rotor (£30) and front cable (£30). Nobody has approved or declined them.
- The inspection is still at **Issues found**.

## Why tracking says "repairs approved"
The tracking page shows "Repairs approved" as soon as **any** repair is approved. It ignores whether some are still waiting for an answer. So both screens show the same records in different ways. Nothing has been lost.

## Fix
- Tracking shows "Repairs partly approved – awaiting your decision on the rest" while any repair is still undecided. It shows "Repairs approved" only when every repair has an answer.
- No data changes. The 3 undecided repairs can be chased with the existing approval link.

## Technical details
- `src/utils/journeyStages.ts` line 47: `summary.repairs_approved_at` is set when the first repair is approved. Add a pending-count check so "approved" only shows when no repairs are still pending.
