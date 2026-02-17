

## Fix: Business Registration Email Notifications Not Sending

### Problem
When a new business account registers, the admin notification email and the user confirmation email are never sent. This is because:

1. The `create-business-user` edge function creates the user but does NOT sign them in
2. After creation, the client-side code (`AuthContext.tsx`) tries to call the `send-email` edge function
3. The `send-email` function requires authentication for these email types
4. Since no user is signed in, the request is rejected with a 401 Unauthorized error
5. The error is caught silently (wrapped in a try/catch that only logs to console)

### Solution
Move the email sending logic into the `create-business-user` edge function itself, which already has the service role key and can call `send-email` server-side with proper authentication, or call Resend directly.

### Changes

**1. Update `supabase/functions/create-business-user/index.ts`**
- After successfully creating the user, send both emails directly from the edge function using Resend (same pattern as `send-email`)
- This avoids the auth issue entirely since the emails are sent server-side
- Send two emails:
  - Confirmation to the new user that their account is pending approval
  - Notification to `info@cyclecourierco.com` with the business details and approval link

**2. Update `src/contexts/AuthContext.tsx`**
- Remove the client-side email sending calls (`sendBusinessAccountCreationEmail` and `sendBusinessRegistrationAdminNotification`) from the `signUp` function
- The edge function now handles this, so the client no longer needs to attempt it
- Remove the unused imports for those two email functions

### Technical Details

The `create-business-user` edge function will:
- Import Resend and use the `RESEND_API_KEY` secret (already available)
- After the `supabase.auth.admin.createUser()` succeeds, send both emails
- Use `Ccc@notification.cyclecourierco.com` as the sender (matching existing configuration)
- Use the production URL `https://booking.cyclecourierco.com/users` for the admin approval link (since `window.location.origin` is not available server-side)
- Email failures will be logged but won't block the user creation response (same behavior as current code)

