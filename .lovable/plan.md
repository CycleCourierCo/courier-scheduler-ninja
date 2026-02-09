

# Fix: Notification Emails Failing Due to Service Role Key Auth

## Problem

The `orders` edge function sends 3 emails via `send-email` after creating an order. Two of them fail because they don't have a whitelisted `emailType`:

| Email | emailType | Auth Result |
|-------|-----------|-------------|
| User confirmation (STEP 1) | none | FAILS - hits requireAuth |
| Sender availability (STEP 2) | `sender` | OK - whitelisted |
| Receiver notification (STEP 3) | none | FAILS - hits requireAuth |

The `send-email` function only bypasses auth for specific email types (`sender`, `receiver`, `sender_dates_confirmed`, `receiver_dates_confirmed`). All other emails go through `requireAuth`, which calls `auth.getUser()` and fails with the service role key.

## Solution

Add service role key detection to the `send-email` function's auth check, exactly like the fix already applied to `generate-tracking-numbers`.

### File: `supabase/functions/send-email/index.ts`

Update lines 48-53 to check for the service role key before falling back to `requireAuth`:

**Before:**
```typescript
if (!publicEmailTypes.includes(reqData.emailType)) {
  const authResult = await requireAuth(req);
  if (!authResult.success) {
    return createAuthErrorResponse(authResult.error!, authResult.status!);
  }
  console.log('Authenticated user:', authResult.userId);
}
```

**After:**
```typescript
if (!publicEmailTypes.includes(reqData.emailType)) {
  // Allow service role key (used when called from other edge functions like orders)
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (token === serviceRoleKey) {
    console.log('Authenticated via service role key for email sending');
  } else {
    const authResult = await requireAuth(req);
    if (!authResult.success) {
      return createAuthErrorResponse(authResult.error!, authResult.status!);
    }
    console.log('Authenticated user:', authResult.userId);
  }
}
```

This is the same pattern already applied to `generate-tracking-numbers` and keeps security intact: public email types remain unauthenticated, non-public types require either a valid user JWT or the service role key.

## Testing

After deployment, trigger another Shopify test webhook to verify all 3 notification emails are sent successfully.

