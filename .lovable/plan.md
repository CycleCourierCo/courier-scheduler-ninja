# Branded driver onboarding signup confirmation email

## Goal

Replace the default Supabase "confirm your signup" email with a branded, driver-focused onboarding email. Non-driver signups keep a friendly generic confirmation email.

## Proposed driver wording

**Subject:** Welcome to Cycle Courier Co. — confirm your email

**Preview text:** You're in — let's get you on the road.

**Body:**

```
Hi {name},

Welcome to the Cycle Courier Co. team! We're really glad you're joining us as a driver.

Please confirm your email address to activate your account and access the driver portal, where you'll find your routes, timeslips, and everything you need for life on the road.

[Confirm email address]

Once confirmed, you can log in at https://booking.cyclecourierco.com/auth.

Questions? Just reply to this email or contact Info@cyclecourierco.com.

Ride safe,
CCC - Cycle Courier Co.
```

Generic fallback copy will be a shorter, polite "confirm your email to finish creating your account" version.

## What changes

1. **Email domain setup**
   - Configure the project's email domain as `notification.cyclecourierco.com` in Cloud → Emails (the same domain used for other emails).
   - DNS verification is needed before emails actually send, but scaffolding and deploy can happen while DNS propagates.

2. **Scaffold auth email templates**
   - Use Lovable's `scaffold_auth_email_templates` to create `supabase/functions/auth-email-hook` and the six auth templates.

3. **Brand the signup template**
   - Apply the project's CSS tokens (primary green, radius, font stack) to the scaffolded `signup.tsx`.
   - Add the existing logo at `https://booking.cyclecourierco.com/cycle-courier-logo.png` to the email header.
   - Set sender to `CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>` and reply-to to `Info@cyclecourierco.com`.

4. **Driver-specific copy**
   - Update `src/pages/UserManagement.tsx` so driver creation passes `role: 'driver'` in the Supabase signup `options.data` metadata.
   - In `signup.tsx`, branch on `user.user_metadata.role === 'driver'` to show the driver onboarding wording above; all other signups get the generic fallback.

5. **Deploy**
   - Deploy the `auth-email-hook` edge function.
   - Provide email preview links so the wording and styling can be reviewed before DNS completes.

## Outcome

- New drivers receive a branded onboarding confirmation email instead of the plain Supabase default.
- Business and customer signups continue to receive a friendly generic confirmation.
- Emails activate automatically once the domain's DNS is verified.
