# Move the staff scan card off the tracking page

## What changes
- **Tracking page becomes customer-only.** The staff bike card is removed from `/tracking/<CCC number>`. Everyone who opens a tracking link, staff included, sees the normal public tracking view. The "Staff? Sign in" link goes too.
- **Staff get the card as a popup on the dashboard.** When signed-in staff scan a label with their phone camera, they go to the dashboard and the bike card opens in a popup (role tabs, bay/load/unload buttons, route check and scan history all stay the same). Closing the popup leaves them on the dashboard.
- **How staff reach it:** the printed labels don't change. When a signed-in staff member opens a tracking link, they're sent straight to the dashboard and the popup opens there. Customers and signed-out visitors stay on the tracking page.
- **Scan page stays as it is** (camera, manual entry, van batch loading) and keeps showing the card inline.
- Optional: a "Scan label" button on the dashboard that opens the camera and shows the result in the same popup.

## Technical details
- `TrackingPage.tsx`: remove `StaffScanPanel` and the staff sign-in link. If the user has a staff role, `navigate('/dashboard?scan=<ref>', { replace: true })`.
- New `StaffScanDialog` wraps `StaffScanPanel` in a Dialog (a Sheet on phones). The dashboard reads `?scan=` and opens it, and closing removes the param.
- Auth redirect: a staff sign-in from a scan lands on `/dashboard?scan=<ref>`.
- Update the AGENTS.md rule: staff scan results never render on the public tracking page.
