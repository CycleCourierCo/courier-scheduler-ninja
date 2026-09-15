# Show partly-declined bikes in the "Repairs Declined" list

## What happens today

The "Repairs Declined" tab only lists bikes whose inspection status is *Repairs declined* — that is, bikes where the customer declined **everything**. When a customer approves some work and declines the rest (a partial rejection), the bike moves straight into Awaiting Parts / Awaiting Repair, and the declined items only surface for offering to the receiver once all the approved work is finished. So partly-declined jobs are invisible in the offer list for days.

## Change

Make the "Repairs Declined" tab list every bike that has at least one declined item still available to sell to the receiver — not yet offered, and not already declined by the receiver — whatever stage the bike is at. That adds partly-declined bikes to the list straight away, so they can be offered to the receiver in parallel with the approved repairs.

- A partly-declined bike appears in both "Repairs Declined" and its repair stage tab (Awaiting Parts / Awaiting Repair). That's intentional: the workshop still sees it in the queue, while the office sees it needs offering.
- Once the declined items are offered, the bike drops out of this tab and shows in "Pending Receiver", as now.
- Fully-declined bikes behave exactly as they do today.
- Nothing about statuses, emails, invoicing or the offer action itself changes — only which bikes the list shows.
- The tab's empty-state wording stays the same; the count badge reflects the wider list.

## Technical notes

- File: `src/pages/BicycleInspections.tsx`. Replace the `repairsDeclined` filter (line 1545) with an issue-based predicate: keep the existing `status === "repairs_declined"` rows, plus any order with an issue where `status === "declined" && !offered_to_receiver_at && !receiver_declined_at`, excluding terminal inspections (`inspected`, `repaired`, `ship_as_is`) and orders with no inspection.
- Issues are already loaded per order (`order.issues`), so no query change is needed; confirm `offered_to_receiver_at` and `receiver_declined_at` are in the page's issue select and add them if not.
- No changes to `src/services/inspectionService.ts` status transitions, no database, RLS or edge function changes.
