# Ireland page + mandatory clock-out explanation

## 1. Clock-out explanation always required
- On the Mechanic Clock page, tapping Clock out always opens the "Before you clock out" popup — not only when the gap is over 30 minutes.
- The popup still shows the day's work recorded vs clocked time; the explanation box must be filled in before clock-out completes.

## 2. New "Ireland" page
- New menu item "Ireland" (Operations section), same people who see Box My Bike today (staff, mechanics, loaders; customers see only their own bikes as now).
- Tabs on the page: **Foam My Bike (NI)**, **Inbound NI**, **Trunk runs**.
- The Foam My Bike and Inbound NI tabs are removed from the Box My Bike page, which then shows only Box My Bike.

## 3. Trunk runs section (on the Ireland page)
Two simple counts for Northern Ireland bikes, with a short list under each (tracking number, bike, town):
- **Ready to collect** — NI jobs not yet collected, with customer dates confirmed.
- **Ready for delivery** — NI jobs collected and at our depot, waiting to go out (not yet delivered or handed to the ferry).
Cancelled and finished jobs are left out. Read-only — no changes to how runs are booked.

Assumption: "trunk runs" here means Northern Ireland bikes. If you meant the existing Scotland Trunk Runs, tell me and I'll show those counts instead.

## Technical details
- MechanicClock.tsx: handleClockOut always opens the dialog; remove threshold branch.
- New src/pages/IrelandPage.tsx reusing FoamMyBikeSection and InboundNiSection; route /ireland in App.tsx and config/routes.ts.
- BoxMyBikePage.tsx: drop section tabs.
- Trunk counts: orders where is_northern_ireland = true, status not in finished list; split by order_collected flag; paginated past 1,000 rows. No database changes.
