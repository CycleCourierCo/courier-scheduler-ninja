

## Fix: Business Registration Email Notifications Not Sending

### Problem
When a new business account registers, neither the user confirmation email nor the admin notification email is sent. The plan for this fix was proposed previously but was **never implemented**.

**Root cause:** The `create-business-user` edge function creates the user but does not sign them in. The client-side code in `AuthContext.tsx` then tries to call the `send-email` edge function, which requires authentication. Since no user is signed in after business account creation, the request fails with a 401 error (caught silently).

### Changes

**1. `supabase/functions/create-business-user/index.ts`**
- After the user is successfully created, send both emails directly from the edge function using Resend (bypassing the `send-email` function entirely)
- **User confirmation email**: Plain text email to the new user confirming their account is pending approval
- **Admin notification email**: HTML email to `info@cyclecourierco.com` with business details and a link to `https://booking.cyclecourierco.com/users` for approval
- Email failures will be logged but will not block the success response (matching current intended behavior)
- Sender address: `Ccc@notification.cyclecourierco.com`

**2. `src/contexts/AuthContext.tsx`**
- Remove the client-side email calls (`sendBusinessAccountCreationEmail` and `sendBusinessRegistrationAdminNotification`) from the `signUp` function
- Remove the unused import for those two functions from `emailService`

### Technical Details

The edge function will:
- Use `npm:resend` (same pattern as the existing `send-email` function) with the `RESEND_API_KEY` secret (already configured)
- Replicate the exact email content currently defined in `src/services/emailService.ts` (subject lines, body text, HTML template)
- Use `https://booking.cyclecourierco.com/users` as the approval link (since `window.location.origin` is unavailable server-side)
- Add Sentry instrumentation using the shared `_shared/sentry.ts` utility for error tracking
- Wrap email sending in a try/catch so failures don't affect user creation

