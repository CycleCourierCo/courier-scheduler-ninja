# Fix inspection customer name, BFS search, and Isle of Man wording

## 1. Mechanics can't see who booked the bike (Bicycle Inspections)
**Cause (confirmed):** the "Account:" line on each inspection card comes from the booking customer's profile. Profiles are only readable by admins, sales staff and the person themselves, so for mechanics the lookup comes back empty and the line (and the customer filter) disappears.

**Fix:** add a small, role-checked server lookup that returns only the booking account's display name (company, or name) and email for the orders on screen, allowed for workshop and office staff (mechanic, CS agent, admin, sales, route planner). The inspection page uses it instead of reading profiles directly. No other profile details (pay, address, etc.) are exposed.

## 2. BFS number on Foam My Bike
- Search box currently only matches tracking number, names, bike, address and bay. Add the BFS number (and the inbound partner reference) to the search.
- The BFS line only appears when a number exists. Show it on every ferry card, with "BFS: not added yet" when empty, so Jabir can see at a glance which bikes still need one. Apply on both outbound and inbound sections.
- Isle of Man bikes label the same field "Order number" instead of "BFS number" everywhere it shows (cards, edit box, partner upload page). Northern Ireland keeps "BFS number".
- Check Jabir's view in the preview afterwards (he has CS/route planner/mechanic roles) to confirm nothing else is hiding it.

## 3. Isle of Man filter still says "Northern Ireland"
Stage names (tabs, badges, Back/Next buttons, confirm dialog, task text) are fixed NI wording: "Crossed the ferry, in Northern Ireland", "Delivered in Northern Ireland", "Awaiting NI collection", "Collected in Northern Ireland".
- When the Isle of Man filter is selected, tab and column headings use Isle of Man wording.
- On each card, the stage badge and buttons use the bike's own region (IoM orders say "Isle of Man" even on the All tab).
- On "All", shared headings read neutrally, e.g. "Crossed the ferry, in NI / IoM".
- Uses the existing region text helper, so NI wording stays exactly as now.

## Technical details
- New migration: `get_booking_account_names(p_user_ids uuid[])` security definer, `search_path=public`, checks `has_role` for the allowed staff roles, returns `id, display_name, email`; `REVOKE EXECUTE FROM PUBLIC, anon`, grant to authenticated.
- `inspectionService.ts`: replace profiles fetch with the RPC.
- `utils/orderSearch.ts`: include `ni_bfs_number` (optional field) in the haystack; add test.
- `FoamMyBikeSection.tsx` / `InboundNiSection.tsx`: label helper `stageLabel(stage, region|filter)` built on `localiseFerryText`; add Vitest for IoM/NI/All label outputs.
