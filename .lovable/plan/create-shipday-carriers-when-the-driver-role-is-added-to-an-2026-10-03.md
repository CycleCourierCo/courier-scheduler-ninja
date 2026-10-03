# Create Shipday carriers when the Driver role is added to an existing user

Today, adding the Driver role to someone who already has an account only saves the role — no Shipday carrier is created, so they can't be matched to route work. (Brand-new drivers already get carriers via the add-driver flow; this covers existing users being made drivers.)

## What changes

1. **Automatic Shipday setup on role change**
   - When the Driver role is added to a user who didn't have it before **and** who has no Shipday carrier saved yet, the app creates the two Shipday entries (main + "Temp") using the existing `create-shipday-carrier` function, with the user's name, email and phone.
   - Both Shipday IDs and names are saved onto the user's record, so route work and carrier matching can use them straight away.
   - If the user already has a Shipday carrier saved, nothing is re-created — no duplicates.

2. **Clear feedback**
   - Success: "Roles updated — Shipday driver created."
   - If Shipday fails (duplicate email, API problem): the role is still saved, and a warning says the Shipday driver couldn't be created so you can retry or link one manually from the driver's record.
   - Removing the Driver role does **not** delete anything in Shipday.

## Technical notes

- `src/pages/UserManagement.tsx` → `handleRolesChange`: after `manage-user-roles` succeeds, detect `nextRoles.includes('driver') && !previousRoles.includes('driver') && !user.shipday_driver_id`. If so, invoke `create-shipday-carrier` with `{ name, email, phone }` from the profile, then update `profiles` with `shipday_driver_id`, `shipday_driver_name`, `shipday_temp_driver_id`, `shipday_temp_driver_name` from the response. Toast reflects partial failure.
- `create-shipday-carrier` is admin-only, so this only fires for admins; sales users editing roles get the role saved with a note that Shipday setup needs an admin.
- No schema or edge function changes — reuses the existing function and profile columns.
