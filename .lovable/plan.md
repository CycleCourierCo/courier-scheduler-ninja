## Problem

Auth logs show recurring `403: Email link is invalid or has expired` / `One-time token not found` errors on `/verify` for password reset, especially for Hotmail/Outlook users. The current flow uses Supabase's default `?token=...` link which hits `/auth/v1/verify` and 303-redirects back to the app with tokens in the URL hash. This token is **single-use** — and Outlook Safe Links, Gmail, and corporate antivirus scanners "click" the link in the background to check it, burning the token before the real user gets there.

Secondary issues:
- `redirectTo` uses `window.location.origin`, so a reset initiated from `id-preview…lovable.app` or any non-primary host sends the user back to the wrong domain. Project rule: all auth flows must land on `booking.cyclecourierco.com`.
- Once the recovery session is established, nothing calls `supabase.auth.signOut()` after the password update, so the user stays signed in via the recovery session without being redirected cleanly.
- Lots of leftover `console.log` debugging in `src/pages/Auth.tsx` and `AuthContext`.

## Plan

### 1. Switch password reset to the PKCE / `token_hash` + `verifyOtp` flow

This is Supabase's recommended fix for the prefetch problem because the token is bound to a code verifier stored in the originating browser — scanners can't consume it.

**a. `src/pages/Auth.tsx` — `handleForgotPassword`**
- Keep `resetPasswordForEmail`, but force `redirectTo` to the absolute primary domain:  
  `https://booking.cyclecourierco.com/reset-password`  
  (not `window.location.origin`).

**b. Add a dedicated `/reset-password` route** (`src/pages/ResetPassword.tsx`, registered in `src/App.tsx` as a public route).
- On mount, read `token_hash` and `type` from the query string (`?token_hash=...&type=recovery`).
- If present, call `supabase.auth.verifyOtp({ type: 'recovery', token_hash })`. Only when this resolves successfully do we render the "set new password" form. This is what defeats prefetch: the verifier in localStorage is required, so background scanners can't complete the exchange.
- Also handle the legacy hash format (`#access_token=...&type=recovery`) as a fallback so any reset emails already in users' inboxes keep working — `detectSessionInUrl: true` is already on, so we just check for the session and show the form.
- On submit, call `supabase.auth.updateUser({ password })`, then `supabase.auth.signOut()`, then `navigate('/auth')` with a success toast. Signing out prevents the recovery session from leaking into a logged-in state.
- Show clear error states: "link expired" (with a "send a new reset email" button that returns to `/auth`) vs. "verifying…" vs. the form.

**c. Update the Supabase Auth "Reset Password" email template** (manual step — call it out in the message to the user, with a link to the dashboard) to use the token-hash format:
```
{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery
```
instead of `{{ .ConfirmationURL }}`. Without this template change the new `/reset-password` page can't pick up `token_hash`, so this is required.

### 2. Clean up `src/pages/Auth.tsx`

- Remove the inline "reset" tab and `ResetPasswordForm` rendering — `/reset-password` becomes the single source of truth.
- Remove all `console.log` debug statements.
- Keep the "forgot password" entry point on the login tab and the "reset email sent" confirmation.

### 3. Clean up `src/contexts/AuthContext.tsx`

- Drop the `isPasswordReset` URL sniffing (it's no longer needed — `/reset-password` is its own route).
- Keep the existing `onAuthStateChange` + `getSession` logic untouched.

### 4. `src/pages/Index.tsx`

- Remove the homepage hash-redirect for `type=recovery` — the email now always points to `/reset-password` directly.

## Technical notes (out of scope to change)

- No DB / RLS changes.
- No edge function changes.
- The Supabase email template update is a dashboard change, not code; I'll surface the SQL Editor / Auth Templates link in the build response.
- We deliberately do **not** switch to OTP codes (numeric code entry) — link flow is preserved, just made prefetch-resistant.

## Files touched

- `src/pages/Auth.tsx` (cleanup, redirectTo to absolute primary domain)
- `src/pages/ResetPassword.tsx` (new)
- `src/App.tsx` (register `/reset-password` route)
- `src/contexts/AuthContext.tsx` (remove `isPasswordReset` plumbing)
- `src/pages/Index.tsx` (remove recovery-hash redirect)
