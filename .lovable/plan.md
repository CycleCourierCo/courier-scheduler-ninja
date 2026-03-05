

## Plan: Add "Check Shipday Carriers" button to User Management page

### Overview
Add a button on the User Management page that calls the Shipday API to retrieve all carriers, then displays them in a dialog. This will help identify carrier IDs for drivers.

### Changes

**1. New Edge Function: `supabase/functions/get-shipday-carriers/index.ts`**
- Simple GET request to `https://api.shipday.com/carriers` using the existing `SHIPDAY_API_KEY` secret
- Returns the carrier list as JSON
- Includes CORS headers and basic auth validation

**2. Update `supabase/config.toml`**
- Add `[functions.get-shipday-carriers]` with `verify_jwt = false`

**3. Update `src/pages/UserManagement.tsx`**
- Add a "Check Shipday Carriers" button next to the page header
- Add state for carriers data and a dialog open state
- On click, invoke the `get-shipday-carriers` edge function
- Display results in a Dialog/table showing: ID, Name, Phone, Email, isActive, isOnShift
- Optionally add a button per carrier row to update a driver's `shipday_driver_id` in their profile

### Technical Details

**Edge Function** calls `GET https://api.shipday.com/carriers` with header `Authorization: Basic {SHIPDAY_API_KEY}`. Returns the array of carrier objects.

**UI** renders a Dialog with a table of carriers. Each row shows the carrier's `id`, `name`, `phoneNumber`, `email`, `isActive`, and `isOnShift` status.

