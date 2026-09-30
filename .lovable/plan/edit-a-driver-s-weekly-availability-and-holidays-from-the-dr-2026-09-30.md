# Edit a driver's weekly availability and holidays from the Drivers Rota

## What admins will get
- On the Drivers Rota, each driver's name gets an **edit button** (desktop grid and mobile list).
- It opens a **pop-up** for that driver with two tabs:
  - **Weekly availability**: tick which days they work every week (Sun–Sat), with start and end times for each day. Saving updates the rota straight away.
  - **Holidays**: add a holiday, sick day, unpaid or other absence with a from/to date and note. Admin-added absences are approved immediately. The tab also lists their upcoming absences with a cancel option and shows their remaining allowance.
- Rota counts ("X available") refresh after any save.
- Only admins see the edit button; route planners keep a view-only rota.

## Technical details
- `src/pages/DriversRota.tsx`: admin role check, edit button beside driver name, dialog state, invalidate rota query on close/save.
- New `src/components/rota/DriverRotaEditDialog.tsx` reusing the existing User Management editors (`DriverAvailabilityTab` for weekly pattern, plus the existing admin absence/holiday UI) and `driverRotaService` functions (`saveWeeklyAvailability`, `createRequest` with approved status, `updateRequest`, `computeAllowance`, `notifyAbsence`).
- No database changes expected; existing admin rules on availability and absence tables are relied on and confirmed during build.
