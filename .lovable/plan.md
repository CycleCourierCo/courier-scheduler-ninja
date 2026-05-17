# Allow Specific Fridays on Availability Calendar

Currently every Friday is hard-disabled on sender/receiver availability calendars. This adds an admin-managed allow-list of specific Friday dates that customers will be able to select.

## What changes for the user

**Holidays page** (`/holidays`): a new "Allowed Fridays" section below the existing holiday cards.
- Multi-select calendar that only lets the admin pick Friday dates
- Name/note field (e.g. "Easter Friday cover")
- List of currently-allowed Fridays with remove button
- Visual badge on existing allowed Fridays in the picker

**Sender/Receiver availability pages**: Fridays remain disabled by default, except dates present in the allowed-Fridays list, which become selectable like any other weekday.

## Technical plan

### 1. Database — new migration

New table `allowed_fridays`:
- `date` (date, unique, not null)
- `name` (text)
- `created_by` (uuid), `created_at` (timestamptz)

RLS:
- Public `SELECT` (so unauthenticated availability pages can read it, mirroring `holidays`)
- `INSERT` / `DELETE` restricted to admins via `has_role(auth.uid(), 'admin')`

CHECK constraint: `EXTRACT(DOW FROM date) = 5` to enforce Friday-only.

### 2. Service layer

New `src/services/allowedFridaysService.ts` mirroring `holidayService.ts`:
- `fetchAllowedFridays()`, `fetchAllowedFridayDates()` (returns `string[]` of `YYYY-MM-DD`)
- `addAllowedFriday(date, name)`, `deleteAllowedFriday(id)`

### 3. Availability calendar logic

`src/hooks/useAvailability.tsx`:
- Fetch allowed Friday dates alongside `holidayDates` on mount
- In `isDateDisabled`, when `date.getDay() === 5`, only disable if the date is NOT in the allowed list
- In the pre-submit filter (line ~209), apply the same allow-list exception so allowed Fridays aren't stripped

`src/components/availability/AvailabilityForm.tsx`: same Friday-disable logic update (line ~83). Pass the allowed list through from the hook.

### 4. Holidays page UI

`src/pages/HolidaysPage.tsx`: add a second grid row (or new pair of cards) with the same Add/List pattern as holidays, but:
- Calendar uses `disabled={(date) => date.getDay() !== 5}` so only Fridays are pickable
- Uses the new service
- Highlights existing allowed Fridays via `modifiers` (green-tinted, to contrast the red holiday styling)

### Out of scope
- No changes to `OpeningHoursEditor` (which already filters Friday out of the per-customer hours editor — unrelated to the customer-facing availability calendar).
- No changes to driver scheduling / route planning.
