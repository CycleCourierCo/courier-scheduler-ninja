

# Fix: Tracking Number Generation Auth Failure from Orders Edge Function

## Problem

When the `orders` edge function calls `generate-tracking-numbers`, it passes the **service role key** as a Bearer token. The `generate-tracking-numbers` function validates this with `auth.getUser(token)`, which only works with **user JWTs** -- so it returns 401 and the Shopify webhook order creation fails.

```text
shopify-webhook --> orders (service role key)
                      |
                      +--> supabase.functions.invoke('generate-tracking-numbers')
                           |
                           +--> requireAuth(req) --> auth.getUser(serviceRoleKey) --> FAILS (401)
```

## Solution

Update the `generate-tracking-numbers` edge function to recognize the **service role key** as a valid authentication method for the `generateSingle` path. This is safe because tracking number generation is a pure string operation with no sensitive data access.

### File: `supabase/functions/generate-tracking-numbers/index.ts`

Update the `generateSingle` auth block (lines 39-43) to first check if the token is the service role key, and if so, skip `getUser()`:

**Before:**
```typescript
if (reqBody.generateSingle === true) {
  const authResult = await requireAuth(req);
  if (!authResult.success) {
    return createAuthErrorResponse(authResult.error!, authResult.status!);
  }
  console.log('Authenticated user for single tracking generation:', authResult.userId);
```

**After:**
```typescript
if (reqBody.generateSingle === true) {
  // Allow service role key (used when called from other edge functions like orders)
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (token === serviceRoleKey) {
    console.log('Authenticated via service role key for single tracking generation');
  } else {
    const authResult = await requireAuth(req);
    if (!authResult.success) {
      return createAuthErrorResponse(authResult.error!, authResult.status!);
    }
    console.log('Authenticated user for single tracking generation:', authResult.userId);
  }
```

This keeps the existing dependency chain intact while allowing the `orders` function (and `shopify-webhook` via `orders`) to generate tracking numbers without a user JWT.

## Testing

After deployment:
1. Send a test request to the shopify-webhook endpoint to verify the full chain works
2. Verify that normal frontend tracking number generation (with user JWT) still works
3. Confirm orders created via the API also generate tracking numbers correctly

