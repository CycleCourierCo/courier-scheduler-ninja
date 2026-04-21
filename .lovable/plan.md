

## Fix DVLA reg lookup (edge function 500)

### Root cause
`supabase/functions/lookup-vehicle/index.ts` validates the caller using `supabase.auth.getClaims(token)`. That method doesn't exist on `@supabase/supabase-js@2.45.0`, so the function throws `TypeError: supabase.auth.getClaims is not a function` and returns a non-2xx — exactly the toast the user saw.

### Fix
Replace the claims call with the standard `auth.getUser(token)` pattern (same one used elsewhere in this project's edge functions):

```ts
const { data: userData, error: userErr } = await supabase.auth.getUser(token);
if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
const userId = userData.user.id;
```

Everything else (admin `has_role` RPC check, DVLA POST, response shape) stays the same.

### Files
- `supabase/functions/lookup-vehicle/index.ts` — swap `getClaims` → `getUser`.

### Verification
- Add Vehicle → type `MD71FDX` → click search → DVLA fields populate, no toast error.
- Non-admin user → still gets 403.
- No auth header → still gets 401.

