# Chasing stuck workshop jobs

Today nothing flags a bike that has sat too long in one workshop stage. A quick look found bikes in "Awaiting parts" for up to 119 days and "Awaiting repair" for up to 148 days. Some of these may already be delivered and never updated.

## What you get

1. **Time limits for each stage** (admins can change them in Workshop settings)
   - Inspection not done: 2 working days after the bike arrives at the workshop
   - Awaiting parts with no parts ordered: 1 working day
   - Awaiting parts, ordered but not arrived: 5 working days, or past the expected arrival date if one was entered
   - Awaiting repair: 2 working days after the customer approves

2. **"Stuck in workshop" list** on the Inspections page
   - A red "Overdue" badge on each late bike, showing how long it has been in that stage
   - A filter showing only overdue bikes, sorted oldest first, with the mechanic's name
   - Bikes already delivered or cancelled are left out, so old records don't clutter the list

3. **Parts ordering made clear**
   - On "Awaiting parts", a mechanic marks "Parts ordered" (with supplier and expected date, both optional), then "Parts arrived"
   - This shows whether a bike is waiting because nobody ordered the parts or because they're still on the way

4. **Chasing**
   - A "Chase" button sends a WhatsApp/email to the mechanic: "Bike X has been in Awaiting parts for 6 days. Please update it."
   - Each chase is logged on the inspection, with who sent it and when
   - A morning digest (8am, Mon–Sat) goes to admins and workshop managers: overdue bikes grouped by stage and mechanic
   - Optional: send mechanics their own overdue list automatically each morning

5. **One-off clean-up**
   - A list of the bikes now stuck in old stages (including ones already delivered), so you can close or correct them

## Questions for you
- Are the default time limits right?
- Should mechanics be chased automatically, or only when staff press Chase?
- Should Saturday count as a working day?

## Technical details
- Use the existing stage timestamps (`awaiting_parts_at`, `awaiting_repair_at`, inspection created/arrived times). Add `parts_ordered_at`, `parts_supplier`, `parts_expected_at`, `parts_arrived_at` on bicycle_inspections, plus an `inspection_chases` log table (RLS: admin and workshop roles via user_roles).
- Store the time limits in workshop_settings.
- New `workshop-overdue-digest` edge function scheduled with pg_cron; chases go through the existing SendZen/Resend paths.
- Overdue badges and the filter live in BicycleInspections.tsx, using a shared helper for overdue rules.
