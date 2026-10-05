# Let admins change a user's login email

## Current state (confirmed by reading the code)

- The Edit User dialog on the User Management page has an Email field, but saving it only updates `profiles.email` — the display email. The actual login email lives in `auth.users` and nothing in the app changes it, so editing that field today does **not** change what the user signs in with.
- No edge function calls `auth.admin.updateUserById`, so there is no way to change a login email at all right now.

## What we'll build

Admins (only) can change a user's login email from the existing Edit User dialog:

1. **New edge function `update-user-email`** (or extend `manage-user-roles`):
   - Admin-role check via the caller's JWT (service role only for the auth update itself).
   - Validates the new email format and that it isn't already taken by another account.
   - Calls `supabase.auth.admin.updateUserById(userId, { email, email_confirm: true })` so the change takes effect immediately without the user needing to confirm via email (they may no longer have access to the old inbox).
   - Updates `profiles.email` to match, keeping display and login in sync.
   - Returns a clear error if the email is already in use.

2. **Edit User dialog** (`src/components/user-management/EditUserDialog.tsx`):
   - When the email field is changed and saved, call the new function instead of just updating the profile.
   - Show a note next to the field: "This is the email they sign in with."
   - Toast confirms the login email was changed; the user list refreshes.

## Notes / limits

- The user's password stays the same; they just sign in with the new email.
- No confirmation email is sent to the old or new address (admin-initiated change) — tell the user their new login email yourself.
- `accounts_email` (used for QuickBooks invoicing) is untouched — it stays a separate field.

## Technical notes

- Files: new `supabase/functions/update-user-email/index.ts` (CORS headers per project standard, admin JWT check, no PII in logs), `src/components/user-management/EditUserDialog.tsx`, possibly `src/pages/UserManagement.tsx` save handler.
- Deploy the new edge function after the code change.
