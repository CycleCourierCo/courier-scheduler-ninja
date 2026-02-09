

# Fix: Receiver Availability Email Not Sent After Sender Confirmation

## Problem Identified

When a sender confirms their availability via the public link (`/sender-availability/:id`), the receiver availability email fails to send with "Auth failed: Invalid or expired token".

### Root Cause

The recent change to `send-email` edge function (switching from `requireAdminAuth` to `requireAuth`) still requires authentication. However:

1. The sender availability page is **public** - no login required
2. When sender confirms dates, `updateSenderAvailability()` calls `resendReceiverAvailabilityEmail()`
3. This invokes `send-email` edge function with **no auth token** (unauthenticated user)
4. The function rejects the request because `requireAuth` requires a valid JWT

### Flow Diagram

```text
Sender clicks availability link (/sender-availability/:id)
         ↓
  [Public Page - No Login]
         ↓
Confirms dates → updateSenderAvailability()
         ↓
Calls resendReceiverAvailabilityEmail()
         ↓
Invokes send-email edge function
         ↓
❌ requireAuth() fails - no auth token
         ↓
Receiver email never sent
```

## Solution

The `send-email` edge function needs to allow **specific email types** to be sent without authentication. These are system-triggered emails from public customer actions:

| Email Type | Triggered From | Auth Required? |
|------------|----------------|----------------|
| `sender` | Sender availability confirmation | No (public page) |
| `receiver` | Sender availability confirmation | No (public page) |
| `sender_dates_confirmed` | Sender availability confirmation | No (public page) |
| `receiver_dates_confirmed` | Receiver availability confirmation | No (public page) |
| Admin/bulk operations | Dashboard | Yes |

### Changes Required

**File: `supabase/functions/send-email/index.ts`**

1. Check the `emailType` before requiring authentication
2. Allow unauthenticated requests for specific customer-facing email types
3. Require authentication for all other email operations (admin emails, custom emails)

```typescript
// After CORS handling, before auth check:
const reqData = await req.json().catch(() => ({}));

// Email types that can be sent from public pages (no auth required)
const publicEmailTypes = ['sender', 'receiver', 'sender_dates_confirmed', 'receiver_dates_confirmed'];

// Only require auth for non-public email types
if (!publicEmailTypes.includes(reqData.emailType)) {
  const authResult = await requireAuth(req);
  if (!authResult.success) {
    return createAuthErrorResponse(authResult.error!, authResult.status!);
  }
  console.log('Authenticated user:', authResult.userId);
} else {
  console.log('Public email type:', reqData.emailType, '- no auth required');
}

// Continue with existing email sending logic...
```

## Security Considerations

- **Public email types are limited** - Only 4 specific types can bypass auth
- **Email recipients are determined by order data** - Not user-supplied, so no spam risk
- **Order IDs are validated** - Must exist in database
- **Rate limiting via Resend** - Protects against abuse
- **All other email operations** still require authentication

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/send-email/index.ts` | Add conditional auth bypass for public email types |

## Testing After Fix

1. Create a new order
2. Open the sender availability link (public page)
3. Confirm sender dates
4. Verify:
   - Sender receives "Thanks for confirming" email
   - Receiver receives availability request email
   - Order status updates to `receiver_availability_pending`

