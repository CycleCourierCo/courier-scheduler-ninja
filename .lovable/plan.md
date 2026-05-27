## Root cause

The reset email link is malformed:

```
https://booking.cyclecourierco.com/auth?action=resetPassword/reset-password?token_hash=...&type=recovery
```

The path is `/auth` (login page). Everything after `?` is a query string, so `token_hash` never reaches `/reset-password`. That's why clicking the email lands on the login screen.

This happened because the template's button `href` was constructed by concatenating `/reset-password?...` onto a URL that already pointed at `/auth?action=resetPassword`. Likely the template still uses something like `{{ .SiteURL }}{{ .ConfirmationURL }}/reset-password?...` or the Site URL was set to `https://booking.cyclecourierco.com/auth?action=resetPassword`.

## Fix — two parts

### 1. Correct the email template (you, in Supabase Dashboard)

Authentication → Email Templates → **Reset Password**. The button/link `href` must be **exactly**:

```
{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery
```

Not `{{ .ConfirmationURL }}`, not concatenated onto anything else. And in Authentication → URL Configuration:

- **Site URL:** `https://booking.cyclecourierco.com` (no path, no query)
- **Redirect URLs** must include `https://booking.cyclecourierco.com/reset-password`

I'll re-send the trimmed branded template so you can paste it verbatim.

### 2. Client-side safety net (code change)

Even with the template fixed, old emails already sent are broken. Update `src/pages/Auth.tsx` so that on mount, if the URL contains `token_hash` + `type=recovery` (or legacy `#access_token=...&type=recovery`), it immediately `navigate('/reset-password?' + params, { replace: true })` before any other auth logic runs. This rescues every malformed link — old and new — by forwarding the token to `ResetPassword.tsx`.

Same guard added to `src/pages/Index.tsx` for completeness (in case the URL lands on `/` with recovery params).

## Technical detail

Files touched:
- `src/pages/Auth.tsx` — add a `useEffect` at top that reads `searchParams.get('token_hash')` / `searchParams.get('type')` and `window.location.hash`, builds the forwarding URL, and calls `navigate('/reset-password?...', { replace: true })` synchronously.
- `src/pages/Index.tsx` — same guard.

No DB or edge function changes. Verification: click the existing broken email link → should now hop to `/reset-password` and show the new-password form.

## What you need to do

1. Fix the template & Site URL in the Supabase Dashboard (instructions above).
2. Approve this plan so I implement the safety-net redirect.