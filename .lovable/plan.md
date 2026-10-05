# Fix: Edit User email not changing the sign-in email

## What's wrong
Your profile already listed Info@cyclecourierco.com, but your real sign-in email is still abdullah@cajarno.com (that's what you logged in with today). When you press Save, the form only updates the sign-in email if the box differs from the profile email. They matched, so nothing changed.

## Fix
1. Edit User shows the real sign-in email (loaded from the account), not the profile copy.
2. If the profile email and sign-in email differ, show a warning: "Sign-in email is X — save to switch to Y."
3. Saving always compares against the real sign-in email, so the change actually happens.
4. The "already in use" check ignores the same person's own profile.

## Your account
After the fix, open your user, press Save, then sign in with Info@cyclecourierco.com (same password). Or I can switch it directly for you once approved.

## Technical details
- New admin-only mode in `update-user-email` (`action: 'get'`) returning `auth.admin.getUserById(userId).user.email`.
- `EditUserDialog.tsx`: fetch auth email on open, compare `newEmail` with it, show mismatch note.
