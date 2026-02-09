

# Fix: Generate Timeslips Authentication Failure

## Problem Identified

The `generate-timeslips` edge function is failing because it calls `query-database-completed-jobs` as a nested function, but the authentication is not being passed correctly.

From the logs:
```
generate-timeslips: Authorized via: admin
query-database-completed-jobs: Auth failed: Invalid or expired token
```

### Root Cause

In `generate-timeslips/index.ts` (lines 67-85):

```typescript
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// This call doesn't pass the auth header
const { data: databaseData, error: dbError } = await supabaseClient.functions.invoke(
  'query-database-completed-jobs',
  { body: { date } }
);
```

The issue is that `supabase.functions.invoke()` does **not** automatically use the service role key for authorization. It uses the client's default behavior, which in this case results in an invalid/missing token being sent to the nested function.

## Solution

**Pass the original Authorization header from the parent request to the nested function call.**

This ensures that when an admin calls `generate-timeslips`, their valid auth token is forwarded to `query-database-completed-jobs`.

### Changes Required

**File: `supabase/functions/generate-timeslips/index.ts`**

1. Extract the Authorization header from the incoming request
2. Pass it to the nested function call via the `headers` option

```typescript
// Around line 72, after parsing the request body:
const authHeader = req.headers.get('Authorization');

// Around line 80, update the functions.invoke call:
const { data: databaseData, error: dbError } = await supabaseClient.functions.invoke(
  'query-database-completed-jobs',
  {
    body: { date },
    headers: authHeader ? { Authorization: authHeader } : {}
  }
);
```

## Why This Works

1. When an admin calls `generate-timeslips`, they send an `Authorization: Bearer <token>` header
2. The `generate-timeslips` function validates this token and confirms the user is an admin
3. The same valid token is then passed to `query-database-completed-jobs`
4. The nested function receives a valid token and successfully authenticates

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/generate-timeslips/index.ts` | Extract auth header from request, pass it to nested function call |

## Post-Fix Testing

After deployment:
1. Go to Driver Timeslips page
2. Click "Generate Timeslips" for any date
3. Verify the function completes successfully without 401 errors

