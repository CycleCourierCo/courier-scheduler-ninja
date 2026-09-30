# Edit driver availability from the Drivers Rota

## What admins will get
- **Click a day cell** (desktop grid or mobile list) to open a small editor for that driver on that date:
  - Working / Not working toggle, start and end times, optional note.
  - "Just this date" (one-off change) or "Every <weekday>" (changes their weekly pattern).
  - "Reset to usual pattern" removes a one-off change.
- **Driver name** gets an edit icon that opens their full weekly pattern (Sun–Sat), the same editor already used in User Management.
- Rota refreshes straight away after saving, including the "X available" counts.
- Holiday/sick days and bank holidays show as now; one-off changes on those days are still allowed and labelled.
- Only admins see the editing controls; route planners keep a view-only rota.

## Technical details
- `src/pages/DriversRota.tsx`: check admin role, wrap `renderCell` in a Popover editor when admin; invalidate the rota query on save.
- Reuse `upsertOverride`, `deleteOverride`, `saveWeeklyAvailability` from `driverRotaService.ts`; reuse `DriverAvailabilityTab` inside a dialog for the weekly pattern.
- No database changes; existing admin access rules on availability tables are relied on (confirm during build, add policy only if a save is refused).
