# Fold the old Vehicles page into Fleet, and tidy up what's left

## Answers in short
- **Anything left to build for fleet?** The four phases are built. What's left is tidying up: the old Vehicles page still holds a few things the new fleet pages don't have yet (listed below), plus two small loose ends.
- **Do we need the old Vehicles page?** Not once its remaining features move across. Right now it is the only place to add a van, refresh DVLA details, edit insurance and see the insurance chart.
- **Insurance chart (gantt):** It currently only sits on the old Vehicles page. It moves to the Fleet dashboard, so it isn't lost.

## What moves where
1. **Fleet dashboard**
   - An "Add van" button, using the same registration lookup as today.
   - An "Insurance cover" section with the same timeline chart: scroll back and forward 3 months, a "today" button, and gaps in cover showing clearly.
2. **Each van's page**
   - A new **Insurance** tab: list, add, edit and delete policies (the same form as today).
   - A "Refresh from DVLA" button beside the registration, to update MOT, tax and make.
   - The Fleet details tab picks up any fields still only on the old edit form (purchase date and mileage, fuel type, colour and so on), so nothing is lost.
3. **Old Vehicles page**
   - Removed from the menu. Anyone opening the old address is sent to the Fleet dashboard, so bookmarks still work.
   - The page itself is deleted once everything above is in place.

## Loose ends tidied in the same pass
- The old "Issues" button on a van's page opens the earlier simple issue list, which only knows Open and Resolved. It goes, and the **Defects** tab becomes the only place for defects. The Fleet dashboard cards link straight to it.
- The "Assigned to" list on defects may only show the person signed in, because fleet managers may not be allowed to see who else has fleet roles. It will read the list of admins and fleet managers in a protected way, so everyone shows.
- Clear the out-of-date fleet lines from the task list.

## Not included (tell me if you want them)
- Removing timeslip admins and loaders from the van warnings.
- Checking every screen while signed in. I can't sign in to the preview, so a fleet manager should click through once after this is built.

## Technical details
- Reuse `AddVehicleDialog`, `InsuranceTab`, `InsuranceTimeline` and `lookupVehicleFromDVLA`/refresh logic from `VehicleManagement.tsx`. Move them into `FleetDashboard.tsx` and `VehicleProfile.tsx`, then delete `VehicleManagement.tsx` and `EditVehicleDialog.tsx` if nothing else uses them.
- `/vehicles` route becomes `<Navigate to="/fleet" replace />`. Remove the "Vehicles" entry from `ADMIN_MENU_SECTIONS` in Layout.tsx and from routes.ts, keeping fleet_manager access through the `/fleet` entry.
- Add a security-definer `fleet_staff_directory()` returning id and name for admin/fleet_manager users, callable only by fleet staff (`is_fleet_staff`). `listFleetStaff` uses it.
- Remove the `VehicleIssuesDialog` usage from VehicleProfile, and from VehicleManagement as it is deleted.
- Mark the stale roadmap fleet lines done.

## Fleet dashboard redesign (from your phone screenshot)
On a phone the dashboard is currently a long list of 15 large boxes, most showing 0, and you have to scroll a long way to find what needs doing.

1. **Fleet status bar at the top.** A single coloured bar split into Operational, Under repair and Out of service, with the counts underneath (for example 7 · 1 · 2 of 11 vans). Tap a part of the bar to filter the van list.
2. **"Needs attention" list.** Only the checks that have something in them, most serious first. Each one is a slim row with a coloured dot, a short label and the count, for example "Service due soon — 11" or "MOT within 30 days — 1". Tap a row to see those vans.
3. **"All clear" line.** Everything at 0 collapses into one muted line, for example "All clear: inspections, critical issues, repairs, tyres", so zeros no longer take up space.
4. **Van list straight after.** Each van gets one compact row showing registration, status and up to two small badges for its most urgent items. Tapping a row opens the van.
5. **Bigger screens.** On a laptop the status bar and the attention list sit side by side, with the van list and upcoming dates below.

Same colours and fonts as the rest of the app. Red, amber and green come from the existing status colours.

### Technical details (dashboard)
- In `FleetDashboard.tsx`, swap the `Stat` grid for a `StatusBar` (status groups, proportional flex segments, semantic `status-*` tokens) and an `AttentionList` built from the existing `tests`/`count` map. Sort it bad first, then warn, and leave out zero entries. Zero entries go into a single muted "All clear" summary.
- Filtering keeps the current `filter` state. The rows use the same `toggle()` as before.
