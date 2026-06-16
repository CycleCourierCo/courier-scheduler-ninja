## Why orders are failing

The `orders` INSERT RLS policy ("Consolidated orders INSERT policy") allows an insert only when the caller has one of these roles via `has_role()`:

```
admin | b2b_customer | b2c_customer | sales | cs_agent | route_planner
```

`has_role()` reads `public.user_roles`, **not** `profiles.role`. Postgres logs at 13:52 today show repeated `new row violates row-level security policy for table "orders"` errors — that is exactly the "Failed to create order" toast from the screenshot.

Querying `user_roles` for the two affected accounts returns **zero rows**:

- Kien Dang / Yellow Jersey (`14285118-…`) — profile role `b2b_customer`, no `user_roles` entry
- Dan Mitchell / Clive Mitchell Cycles (`10fd76f6-…`) — profile role `b2b_customer`, no `user_roles` entry

A wider check shows **71 customer profiles** are missing their `user_roles` row. They worked in the past because their last orders pre-date the stricter RLS policy; any new attempt now fails.

Root cause: `handle_new_user` writes the role onto `profiles` but never inserts the mirror row into `user_roles`, so every account created after the user_roles migration is broken for order creation.

## Fix

### 1. One-off backfill (migration)
For every `profiles` row whose `role` ∈ {admin, b2b_customer, b2c_customer, sales, cs_agent, route_planner, loader, driver, timeslip_admin, mechanic} and which has no matching `user_roles` row, insert `(user_id, role)`. Idempotent via `ON CONFLICT (user_id, role) DO NOTHING`.

Expected: ~71 inserts. After this, Clive and Kien can submit immediately.

### 2. Stop the regression at source (migration)
Update `public.handle_new_user()` so that, in the same transaction as the `profiles` insert, it also inserts the appropriate row into `public.user_roles` (`b2b_customer` when `is_business=true`, otherwise `b2c_customer`). Wrap in `ON CONFLICT DO NOTHING` so re-runs are safe.

Trigger itself (`on_auth_user_created`) stays unchanged — only the function body is updated. No edit to `auth.users`.

### 3. Verification
- Re-run the missing-roles query — must return 0.
- Have Kien or Clive retry; or use Playwright as a B2B test account to POST the create-order form and confirm a 200.

## Out of scope
- No change to RLS policies, no change to `profiles.role`, no UI changes.
- Not touching the `user_roles` table schema or its policies.

## Technical detail (for reviewers)
- Migration is two statements: backfill `INSERT … SELECT … ON CONFLICT DO NOTHING` + `CREATE OR REPLACE FUNCTION public.handle_new_user()`.
- `handle_new_user` already runs as `SECURITY DEFINER` with `search_path = public`, so it can write `user_roles` without extra grants.
- No data loss risk: backfill only inserts where rows are missing; function update only adds an additional insert.
