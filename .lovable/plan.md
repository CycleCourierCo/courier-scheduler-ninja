

# Fix: Forward Cron Secret to Nested Edge Function Call

## Problem
`generate-timeslips` authenticates successfully via `X-Cron-Secret`, but when it invokes `query-database-completed-jobs`, it only forwards the `Authorization` header (the anon key). The nested function also requires `requireAdminOrCronAuth` and rejects the anon key as an invalid JWT. The `X-Cron-Secret` is never passed along.

## Solution
Update `generate-timeslips` to forward the `X-Cron-Secret` header to the nested function call when authenticated via cron. This way the nested function can also validate via the cron secret path.

## Technical Change

**File: `supabase/functions/generate-timeslips/index.ts`**

Update the nested function invocation (around line 87) to also forward the `X-Cron-Secret` header:

```typescript
// Current (broken):
headers: authHeader ? { Authorization: authHeader } : {}

// Fixed:
const cronSecret = req.headers.get('X-Cron-Secret');
// ...
headers: {
  ...(authHeader ? { Authorization: authHeader } : {}),
  ...(cronSecret ? { 'X-Cron-Secret': cronSecret } : {})
}
```

This is a single-line change in one file. No other files need modification.

