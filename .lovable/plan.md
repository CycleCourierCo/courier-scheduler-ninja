

# Admin Holiday Management for Availability Calendar

## Overview
Create a new admin-only page where admins can add/remove holiday dates. These holidays will be fetched by the sender and receiver availability forms and blocked from selection.

## Database Changes

### New table: `holidays`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated |
| date | date | The holiday date |
| name | text | Holiday name/reason |
| created_by | uuid (FK -> profiles) | Admin who created it |
| created_at | timestamptz | Auto-set |

RLS policies:
- SELECT: allow all (public pages need to read holidays)
- INSERT/DELETE: admin only via `is_admin()` check

## New Files

### 1. `src/pages/HolidaysPage.tsx`
- Admin page with a calendar view and a list of existing holidays
- Calendar in "multiple" select mode to pick dates
- Text input for holiday name
- "Add Holiday" button to save
- Table listing all holidays with a delete button per row
- Protected with `adminOnly={true}` route

### 2. `src/services/holidayService.ts`
- `fetchHolidays()` - get all holidays
- `addHoliday(date, name)` - insert a holiday
- `deleteHoliday(id)` - remove a holiday
- `fetchHolidayDates()` - returns just the date strings for use in availability forms

## Modified Files

### 3. `src/App.tsx`
- Add route: `/holidays` -> `HolidaysPage` wrapped in `ProtectedRoute adminOnly={true}`

### 4. `src/hooks/useAvailability.tsx`
- On mount, fetch holiday dates via `fetchHolidayDates()`
- Add holiday dates to `isDateDisabled` logic so they cannot be selected

### 5. `src/components/availability/AvailabilityForm.tsx`
- Pass holiday dates into the `defaultIsDateDisabled` function so both sender and receiver forms block holidays

### 6. `src/components/Layout.tsx` (if navigation exists)
- Add "Holidays" link in admin navigation

## How It Works

1. Admin navigates to `/holidays`, selects dates on the calendar, names the holiday, and saves
2. Holiday dates are stored in the `holidays` table
3. When a sender or receiver opens their availability form, holiday dates are fetched and disabled on the calendar
4. Disabled holiday dates appear greyed out and cannot be clicked

