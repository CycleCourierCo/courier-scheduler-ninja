# Fix "infinite recursion" when saving driver availability, and admin holiday logging

## What's wrong
- Saving availability updates the driver's profile (leave days, leave year, depot). One of the profile edit rules ("self update, no role escalation") checks the user's current role and account status by looking up the profiles table from inside a rule on the same table. The database treats that as a loop and rejects the save, even for admins, because every edit rule is checked.
- Adding a holiday as an admin: the cause is not yet confirmed. The first step is to reproduce it and read the exact error. It may be the same loop, or a separate rule on the absence table.

## Fix
1. Add a small secure lookup that returns a user's current role and account status without going through the profile rules.
2. Rewrite the "self update" rule to use that lookup. Users still can't change their own role or account status, and admins keep full edit access.
3. Reproduce "Log absence" as an admin, read the real error, and fix whatever it shows.
4. Test both flows signed in as an admin: save availability for a driver, then log a holiday for them. Also confirm that a driver still can't change their own role.

## Technical details
- New `public.current_profile_guard(_uid uuid) returns table(role user_role, account_status account_status_type)`. It's `STABLE SECURITY DEFINER` with `search_path=public`. Grant execute to `authenticated` only.
- Drop and recreate `"Profiles self update (no role escalation)"`:
  - USING `(select auth.uid()) = id`
  - WITH CHECK the same, with role and account_status compared against the helper
- Run the security linter afterwards.
