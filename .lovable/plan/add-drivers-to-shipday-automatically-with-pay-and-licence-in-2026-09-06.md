# Add drivers to Shipday automatically, with pay and licence in one go

When an admin adds a new driver in the portal, the app will also create two entries in Shipday and let the admin set pay and upload licence documents on the same screen.

## What changes

1. **Two Shipday drivers created automatically**
   - Entry 1: the driver's first name, their phone number and their email.
   - Entry 2: the driver's first name plus " - Temp", with a made-up email and phone number so Shipday accepts it.
   - Both Shipday IDs are stored against the driver so route work can use them; the main one links into the existing carrier matching.
   - If Shipday refuses (duplicate email, key problem), the portal user is still created and a clear message explains what failed, so nothing is lost.
   - Only applies to newly added drivers — existing drivers are untouched.

2. **Pay on the add-driver form**
   - When the role is set to Driver, the form shows phone number, hourly rate and workshop hourly rate fields.
   - The Pay tab on an existing driver's record becomes visible for drivers too, not just mechanics.

3. **Licence documents during creation**
   - When the role is Driver, the form also offers licence number, expiry date, licence front, licence back and check code document uploads.
   - Files are uploaded once the account exists and saved against the new driver in one step.

## Technical notes

- New edge function `create-shipday-carrier` (admin-only via `requireOpsAuth(['admin'])`, `trackedFetch` for integration logging) POSTs to `https://api.shipday.com/carriers` twice using `SHIPDAY_API_KEY`, returning both created carrier IDs/names. Never called directly from an unauthenticated path.
- Migration: add `shipday_temp_driver_id` and `shipday_temp_driver_name` to `public.profiles` (nullable text). Existing `shipday_driver_id` / `shipday_driver_name` hold the main carrier.
- Temp entry email/phone are generated deterministically, e.g. `<firstname>.temp+<short id>@cyclecourierco.com` and a fixed placeholder number, to avoid Shipday duplicate errors.
- `UserManagement.tsx`: extend `newUser` state with phone, hourly_rate, workshop_hourly_rate, licence fields and pending files; conditionally render a driver block. After `signUp` + `manage-user-roles`, update the new profile row, upload files to the existing `driver-licences` bucket via the same paths used by `DriverLicenceTab`, then invoke `create-shipday-carrier` and store returned IDs.
- Extract the licence upload slots from `DriverLicenceTab.tsx` into a reusable piece so create and edit share one implementation instead of duplicating it.
- `EditUserDialog.tsx`: show the Pay tab when `isDriver || isMechanic`.
