# Clean Air Zone page and daily driver checks

## What you'll get
A new **Clean Air Zones** page under Operations in the admin menu.

1. **Zones list and map**: Bath, Birmingham, Bradford, Bristol, Portsmouth, Sheffield and Tyneside (Newcastle and Gateshead), drawn from the maps you uploaded. Each zone shows its daily charge for a van, which you can edit, and a link to that council's pay page.
2. **Weekly view** (Mon–Sun, with previous/next week buttons): one row for each time a driver entered a zone. It shows the day, driver, van registration, zone, charge, and whether it's been paid. Weekly totals are shown for each zone and for each driver.
3. **Mark as paid**: tick a row once it's paid (who paid it and when is saved). Unpaid rows stand out. There's also a CSV export.
4. **Van exemptions**: each van can be marked "compliant" for a zone, for example a Euro 6 diesel van that isn't charged. Trips by that van still appear on the page but show as "no charge".

## How the daily check works
- Every morning (06:00 UK time) the system reads the previous day's timeslips, both draft and approved.
- For each timeslip it rebuilds the actual road route in stop order (depot, then each stop, then back to the depot) using Google directions, the same way the route maps already do.
- If that road route passes through any zone, even without a stop inside it, a charge row is added for that driver, van and day. Each zone is charged once per van per day.
- The check never adds the same charge twice. A **Re-check** button lets you run any day again, for example after a timeslip has been edited.

## Assumptions to confirm
- Default van charges: £9 a day in Bath, Birmingham, Bradford, Bristol, Sheffield and Tyneside, and £0 in Portsmouth, where vans aren't charged. You can edit all of these on the page.
- Routes are rebuilt from the timeslip's stops, so the check shows the route we planned, not GPS tracking of where the van actually drove.

## Technical details
- Zone outlines are stored as `src/data/cleanAirZones.ts`, built from the 7 GeoJSON files. Bristol has 2 parts and is kept as a MultiPolygon.
- Tables `clean_air_zones` (slug, name, daily_charge, pay_url) and `caz_vehicle_exemptions` (vehicle_id, zone_slug), plus `caz_charges` (date, driver_id, vehicle_id, timeslip_id, zone_slug, charge, paid_at, paid_by). `caz_charges` has a unique index on (date, vehicle_id or driver_id, zone_slug). All three tables have GRANTs and RLS: admins can read and write, and only the service role can insert charges.
- A new edge function `caz-daily-check` takes `{ date? }` and is called either with X-Cron-Secret or by a staff user with a JWT. It pages through timeslips with `.range()`, calls the Google Routes API through the gateway for an encoded polyline, decodes it, and tests for a polyline–polygon intersection: any point inside the zone or any segment crossing its edge, with a bounding-box prefilter. Writes use upserts. Calls are batched to stay within time limits.
- The cron job uses the existing SECURITY DEFINER wrapper pattern and runs daily at 06:00 Europe/London.
- New page `src/pages/CleanAirZonesPage.tsx` with a Leaflet map. It is added to the route config, permissions, and `ADMIN_MENU_SECTIONS` in Layout.tsx.
