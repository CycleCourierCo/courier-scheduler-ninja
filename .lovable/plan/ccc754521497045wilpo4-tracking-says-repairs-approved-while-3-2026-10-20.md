# CCC754521497045WILPO4: tracking says "repairs approved" while 3 repairs are still undecided

## What the records show
- The inspection on 2 Oct found 5 repairs, and the approval went to the account holder.
- On 8 Oct at 12:41 (London time), 2 repairs were approved, 12 seconds apart: the rear cable (£30) and the chain (£30).
- The other 3 have no answer yet: rear pads (£35), rear rotor (£30) and front cable (£30). Nobody has approved or declined them.
- The inspection is still at **Issues found**.

## Why tracking says "repairs approved"
The tracking page shows "Repairs approved" as soon as **any** repair is approved. It ignores whether some are still waiting for an answer. So both screens show the same records in different ways. Nothing has been lost.

## Fix
- There is no "partly approved" message. Tracking shows "Repairs approved" only when every repair has an answer **and** the bike has moved to **Awaiting parts** or **Awaiting repair** (or a later stage such as Repaired).
- Until then, including this order, tracking stays on the inspection step (awaiting the customer's decision).
- No data changes. The 3 undecided repairs can be chased with the existing approval link.

## Technical details
- `src/utils/journeyStages.ts` line 47: stop using `summary.repairs_approved_at` alone. Treat repairs as approved only when the inspection status is `awaiting_parts`, `awaiting_repair`, `in_repair`, `cleaning` or `repaired`.
- Check that the tracking summary includes the inspection status. If it doesn't, add it to the public tracking data.
