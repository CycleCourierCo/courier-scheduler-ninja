# Group same-day mechanic slips into one card

## Problem
When a mechanic clocks in and out more than once on the same day (e.g. Sami Top Tech, Fri 2 Oct 2026 — an 11:19–12:56 session and a 16:21–17:56 session), the Timeslips page shows two separate cards. You want them shown as a single slip for that day.

## Approach
Keep the underlying records as they are (each clock in/out stays its own row — this preserves the audit trail, photos and GPS pins), but **merge them for display** on the admin Timeslips page.

## Changes

1. **Grouping helper** (`src/services/mechanicTimeslipService.ts`)
   - Add a function that groups a mechanic's slips by person + calendar date (Europe/London), ordered by clock-in time.

2. **Merged card** (`src/components/timeslips/MechanicTimeslipCard.tsx` and `src/pages/DriverTimeslips.tsx`)
   - A day with multiple sessions shows as **one card** titled with the mechanic and date, with a "2 sessions" badge.
   - The card lists each session's clock in/out times with its photo and map link, one under the other.
   - Totals are combined: total hours, lunch, and pay (sum of all sessions at the mechanic's rate).
   - The "Work done" list combines all work recorded that day.
   - Status shown is the day's overall status: if any session is still open the card shows Open; otherwise Closed/Approved as appropriate.

3. **Actions**
   - Approve / Reject on a merged card applies to **all** of that day's sessions in one go (with a confirmation noting how many sessions it affects).
   - Edit and delete still work per session (a small edit/delete control on each session row inside the card), so individual mistakes can still be corrected.

4. **Counts and filters**
   - Draft/Approved/All counts count days (merged cards), not raw sessions, so the numbers match what you see.

## Out of scope
- No database changes; no changes to how mechanics clock in/out.
- Driver timeslips are unchanged.
