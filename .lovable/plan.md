# Fix sign-in email not changing

## What's wrong (confirmed)

Both accounts have a mismatch between the email shown and the email they sign in with:

| Account | Email shown | Actual sign-in email |
|---|---|---|
| Alper Muduroglu | info@trybeforeyoubike.com | alper@pedaluk.com |
| Abdullah | Info@cyclecourierco.com | abdullah@cajarno.com |

The Edit User box only changes the sign-in email when the typed email differs from the **shown** email. Since the shown email already says the new address, saving does nothing to the sign-in email.

## Fix

1. **Edit User save**: always send the email to the sign-in update on save. The server compares it with the real sign-in email and only changes it if different (no-op otherwise).
2. **Server check**: the "already used" check ignores the same person, so these two accounts won't be blocked by their own shown email.
3. **Fix these two now**: after the change, open each user and press Save — or I set them directly so both can sign in with the new address straight away (passwords unchanged).

## Technical notes

- `EditUserDialog.tsx`: drop the `newEmail !== oldEmail` condition; call `update-user-email` whenever email is present.
- `update-user-email`: fetch `auth.admin.getUserById`; if the auth email already matches, just sync profile and return success.
- One-off: call the function logic (service role) for user ids 88ea5ec8… and d0829a22… to set auth emails to info@trybeforeyoubike.com and info@cyclecourierco.com.
