## Problem

In `src/components/scheduling/RouteBuilder.tsx`, `groupJobsByLocation` bundles any jobs within 750m into one "grouped location" card, using coordinates only. This causes two issues on the route timeslots drawer:

1. Two nearby but unrelated jobs (different customer email/phone) get merged into a single grouped card — they should stay separate.
2. The per-row `×` button calls `removeJob` for only the clicked job, so when a card visually represents a grouped location, the other jobs in the bundle remain in the route.

## Fix

### 1. Only group by location when the recipient is the same customer

In `groupJobsByLocation` (RouteBuilder.tsx ~line 1530), extend the group-matching predicate. Two jobs share a location group only when **all** of the following match:

- Coordinates within `LOCATION_GROUPING_RADIUS_METERS` (existing check), AND
- Same normalized contact email (pickup uses `orderData.sender.email`, delivery uses `orderData.receiver.email`), OR when both emails are missing, same normalized phone number.

Add a small helper `getContactKey(job)` that returns `email || phone || null` lowercased/trimmed. When either candidate has no key, fall back to the current location-only check (keeps today's behaviour for legacy rows without contact data). When both have keys and they differ, do NOT merge.

### 2. Make the `×` button remove the whole group when the card is grouped

Update `removeJob` (~line 1467) to accept a job and, if it belongs to a `locationGroupId` and the group currently has >1 members, remove every job that shares the same `locationGroupId` (and same `type` scoping is not needed — the group card represents them all). Otherwise fall back to today's single-job filter.

Keep the reindexing (`order: index + 1`) after filtering.

No changes to `MultiJobTimeslotDialog.tsx` — it renders individual cards, not grouped ones.

### Technical notes

- `SelectedJob` already carries `orderData.sender` / `orderData.receiver`; no new fetches needed.
- `locationGroupId` is stamped in `groupJobsByLocation`; `selectedJobs` in state may or may not have it depending on when grouping last ran. To make the `×` reliable in all states, recompute the current grouping (`groupJobsByLocation(selectedJobs)`) at the top of `removeJob` and use it to look up the target's group members, then filter `selectedJobs` by those `orderId+type` pairs.
- No DB or edge-function changes.

## Out of scope

- Grouped WhatsApp/SendZen send buttons already key off `locationGroupId`; the new email-aware grouping will naturally keep them from bundling different customers.
