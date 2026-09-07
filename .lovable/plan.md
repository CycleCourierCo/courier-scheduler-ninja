# Fix new driver details not saving

## What's happening now

Looking at the three drivers added today, the pattern is the same each time:

- Both Shipday entries were genuinely created (the Shipday call log shows a "create carrier" and a "create temp carrier" success at the moment each driver was added).
- But the driver's record kept none of it: no Shipday IDs or names, no licence files, no pay values at the time of creation.
- The pay and licence details on those records were only filled in 4-7 minutes later, i.e. by hand from the edit screen afterwards.

So the Shipday side works, and the saving-back-to-the-driver's-record side does not. The cause is that the browser signs the new driver up from the admin's own session: as soon as the account is created the admin's signed-in state is disturbed, so the follow-up steps (saving pay, saving the Shipday IDs, uploading the licence files, which are admin-only) quietly do nothing and no error is reported. That's why nothing complains but nothing sticks.

## The fix

Do the whole driver creation on the server instead of in the browser, so it never depends on who is signed in mid-way.

1. **One server step creates everything.** A new admin-only server function creates the login, sets the role, saves phone, hourly rate and workshop hourly rate, licence number and expiry, creates the two Shipday entries, and stores both Shipday IDs and names on the driver's record — all in one go, with the admin's own session untouched.
2. **Licence files upload reliably.** The chosen licence front, back and check-code files are uploaded after the account exists and their locations saved on the driver's record in the same step. Each file that fails is named in the message rather than failing silently.
3. **Clear feedback.** If part of it fails (for example Shipday rejects a duplicate email), the driver is still created and the message says exactly what didn't save, instead of appearing to succeed.
4. **Backfill the three existing drivers.** Their Shipday "Temp" entries already exist in Shipday, so their main and Temp IDs get linked onto their records so route work can use them.

## Technical notes

- New edge function `create-driver-user`: `requireOpsAuth(req, ['admin'])`, service-role client, `auth.admin.createUser` (email confirmed), insert into `user_roles` + mirror `profiles.role`, then a single `profiles` update with pay/licence/Shipday fields. Returns per-step status so the UI can report partial failures.
- Licence files: browser uploads to `driver-licences` at `${userId}/${fileBase}.${ext}` after the function returns the new user id (admin session is still valid at that point), then a second call to the function (or a `paths` argument on a follow-up `PATCH`) records the paths and `licence_updated_at`. Alternative if simpler: post the files to the function as base64 and let the service role write them — chosen at implementation time based on file size limits.
- `UserManagement.tsx`: replace `supabase.auth.signUp` + `manage-user-roles` + client-side `profiles.update` in `handleCreateUser` with the single `create-driver-user` invoke; keep `PendingLicenceUploads` as-is. Add `.select('id')` on any remaining client updates so zero-row RLS outcomes surface as errors instead of silence.
- `supabase/config.toml`: register `create-driver-user` with `verify_jwt = false` (it authorises in code), matching `create-shipday-carrier`.
- Backfill via a one-off query matching Shipday carrier IDs 556816 / 556813 / 556700 and their `- Temp` counterparts (fetched with `get-shipday-carriers`) onto the three driver profiles.
