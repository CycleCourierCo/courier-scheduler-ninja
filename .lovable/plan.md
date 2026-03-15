

## Add Opening Hours to B2B Profiles and Display in Route Builder

### Database Change
Add an `opening_hours` JSONB column to the `profiles` table to store per-day open/close times:

```sql
ALTER TABLE public.profiles ADD COLUMN opening_hours jsonb;
```

JSON structure:
```json
{
  "monday":    { "open": true, "start": "09:00", "end": "17:00", "is24h": false },
  "tuesday":   { "open": true, "start": "09:00", "end": "17:00", "is24h": false },
  "wednesday": { "open": true, "start": "09:00", "end": "17:00", "is24h": false },
  "thursday":  { "open": true, "start": "09:00", "end": "17:00", "is24h": false },
  "friday":    { "open": true, "start": "09:00", "end": "17:00", "is24h": false },
  "saturday":  { "open": false, "start": "", "end": "", "is24h": false },
  "sunday":    { "open": false, "start": "", "end": "", "is24h": false }
}
```

### Code Changes

**1. `src/types/user.ts`** — Add `opening_hours` to `UserProfile` interface.

**2. `src/components/user-management/EditUserDialog.tsx`** — Add an "Opening Hours" section inside the Business tab with a day-by-day grid: toggle open/closed, 24h switch, start/end time inputs.

**3. `src/pages/UserProfile.tsx`** — Add an Opening Hours card for business users to self-manage their hours.

**4. `src/components/scheduling/RouteBuilder.tsx`** — Batch-fetch profiles for all unique `user_id`s from orders in the route. Display opening hours on job cards as a compact line (e.g. "🕐 Mon-Fri 09:00-17:00").

**5. `src/components/scheduling/TimeslotEditDialog.tsx`** — Accept and display opening hours in the timeslot edit popup, showing the relevant day's hours based on the selected date.

### Technical Details

- Opening hours are fetched in a single batch query: `from('profiles').select('id, opening_hours').in('id', userIds)` stored as `Record<string, OpeningHours>`.
- Each job card maps `job.orderData` → `user_id` → profile opening hours. The order's `user_id` represents the business customer.
- In the TimeslotEditDialog, when a date is selected, show that specific day's hours (e.g. "Thursday: 09:00 - 17:00" or "Closed").
- The UserProfile page shows the opening hours editor only for business accounts (`userProfile?.is_business`).

### Summary
- 1 migration (add column)
- 5 files changed
- No new tables or RLS changes needed (opening_hours lives on existing profiles table with existing policies)

