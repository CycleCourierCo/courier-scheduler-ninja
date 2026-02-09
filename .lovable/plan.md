
# Fix: B2B User Order Creation Failure

## Problem Identified

When a B2B user tries to create an order, the process fails with a **403 Forbidden** error because:

1. Order creation calls `generateTrackingNumber()` in `src/services/trackingService.ts`
2. This invokes the `generate-tracking-numbers` edge function
3. The edge function uses `requireAdminAuth()` which requires the user to have admin role
4. B2B users are not admins, so they get rejected with "User is not admin"

From the logs:
```
Auth failed: User is not admin {
  userId: "eb499436-60ec-48ac-8d2c-f66dc6126559"
}
```

## Solution

The `generate-tracking-numbers` function needs two different authentication levels:

| Operation | Who Can Call | Auth Required |
|-----------|--------------|---------------|
| `generateSingle: true` (new order) | Any authenticated user | Basic auth |
| Bulk regeneration / specific order update | Admin only | Admin auth |

### Changes Required

**File: `supabase/functions/_shared/auth.ts`**

Add a new function for basic authenticated user validation (not admin-only):

```typescript
/**
 * Require basic authentication via JWT (any authenticated user)
 * Validates token but does NOT check for admin role
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('Auth failed: No bearer token provided');
    return { success: false, error: 'Unauthorized', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    console.error('Auth failed: Invalid or expired token');
    return { success: false, error: 'Unauthorized', status: 401 };
  }

  return { success: true, userId: user.id };
}
```

**File: `supabase/functions/generate-tracking-numbers/index.ts`**

Update the authentication logic to:
1. Allow any authenticated user for single tracking number generation
2. Require admin for bulk operations and order updates

```typescript
import { requireAuth, requireAdminAuth, createAuthErrorResponse } from '../_shared/auth.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const reqBody = await req.json().catch(() => ({}));
    
    // For single tracking number generation (new orders)
    // Allow any authenticated user
    if (reqBody.generateSingle === true) {
      const authResult = await requireAuth(req);
      if (!authResult.success) {
        return createAuthErrorResponse(authResult.error!, authResult.status!);
      }
      
      const senderName = reqBody.senderName || "UNKNOWN";
      const receiverZipCode = reqBody.receiverZipCode || "000";
      const trackingNumber = generateCustomOrderId(senderName, receiverZipCode);
      
      return new Response(
        JSON.stringify({ success: true, trackingNumber }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // For all other operations (bulk update, specific order)
    // Require admin authentication
    const authResult = await requireAdminAuth(req);
    if (!authResult.success) {
      return createAuthErrorResponse(authResult.error!, authResult.status!);
    }
    
    // ... rest of existing admin-only logic
  } catch (err) {
    // ... error handling
  }
});
```

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/_shared/auth.ts` | Add `requireAuth()` function for basic authentication |
| `supabase/functions/generate-tracking-numbers/index.ts` | Use `requireAuth` for single generation, keep `requireAdminAuth` for bulk operations |

## Security Considerations

- Single tracking number generation (`generateSingle: true`) only returns a random string - no database access
- Bulk operations and database updates still require admin authentication
- This is a minimal change that allows order creation while maintaining security for sensitive operations

## Testing

After deployment:
1. Log in as a B2B user (non-admin)
2. Create a new order
3. Verify the order is created successfully with a tracking number
