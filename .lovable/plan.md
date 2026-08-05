# Tidy mechanic timeslips + editable clock times

## 1. Cleaner admin UI (Mechanic Timeslips tab)
Rework each timeslip card so it stops overlapping on mobile:

- Header row: mechanic name, date, status badge (aligned left, wraps cleanly).
- Two compact "Clock in" / "Clock out" blocks side by side, each with photo thumbnail, time and map link, stacking to one column on small screens.
- A summary strip for Hours / Lunch / Rate / Pay using a small grid instead of floating right-aligned columns.
- Action buttons (Approve, Reject, Edit, Delete) grouped in a full-width footer row that wraps, so no button lands under text.
- Filter bar and "Total pay shown" card stack on mobile instead of sitting side by side.

No behaviour change to approve/reject/delete.

## 2. Admin can edit clock in/out times
In the edit dialog, add datetime inputs for clock in and clock out alongside the existing rate, lunch, status and notes fields. Saving sends the new timestamps, and hours/pay recompute from them as they already do for other edits. Clock out can be cleared to reopen a shift.

## 3. Lunch defaults to 0
Change the database default for lunch hours on mechanic timeslips from 0.5 to 0, so new shifts start with no lunch deduction until an admin sets one. Existing records are untouched.

## Technical notes
- `src/components/timeslips/MechanicTimeslipsTab.tsx`: layout rewrite plus `datetime-local` fields wired into the existing `EditState`, converting to/from ISO on save.
- `updateMechanicTimeslip` already accepts `clock_in_at` / `clock_out_at`, so no service change is needed.
- One migration: `ALTER TABLE public.mechanic_timeslips ALTER COLUMN lunch_hours SET DEFAULT 0;`
