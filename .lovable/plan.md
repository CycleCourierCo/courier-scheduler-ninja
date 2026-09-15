# Implement Idempotency-Key support in the orders API

## Why

The API documentation (docs/API_DOCUMENTATION.md, ApiDocumentationPage.tsx) instructs integrators to send an `Idempotency-Key` header, but `supabase/functions/orders/index.ts` never reads it — the header is ignored. Duplicate protection today relies solely on the `customer_order_number` lookup, which is permanent, race-unsafe, and does nothing when the field is omitted. This plan makes the documented header real and gives it a defined retention window.

## Current behaviour (verified in code)

- `orders/index.ts` (~line 262): if `customer_order_number` is present, an existing order for the same user is returned with `idempotent: true`. No expiry — matches live `orders` rows forever.
- No `idempotency_keys` table exists; the header is never read.

## Changes

### 1. Migration — `public.idempotency_keys`

```sql
create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);
alter table public.idempotency_keys enable row level security;
grant all on public.idempotency_keys to service_role;
grant select, insert, update on public.idempotency_keys to authenticated;
```

- No anon access; no client-facing policies beyond the grants (accessed only by the edge function and service role).
- Index on `created_at` for cleanup.

### 2. `orders/index.ts` — honour the header on POST order creation

- Read `Idempotency-Key` header (also accept `idempotency_key` in the JSON body).
- If the key exists for this user and has an `order_id`, return that order with `idempotent: true` (same shape as the existing `customer_order_number` hit).
- If the key exists but is still in flight / order creation failed, return a clear 409 retry response.
- Otherwise claim the key first (`insert ... on conflict (user_id, key) do nothing`); if the claim is lost (concurrent retry), re-select and return the winner's order — this closes the race window.
- After the order is created, write its `order_id` onto the claim row.
- Retention: before the claim insert, delete rows older than **7 days** for that user (`created_at < now() - interval '7 days'`). A retry with the same key is safe for 7 days; after that it is treated as a new request.
- Keep the existing `customer_order_number` behaviour unchanged — it takes priority when both are provided.

### 3. Deploy and document

- Deploy the `orders` edge function.
- Update docs/API_DOCUMENTATION.md and ApiDocumentationPage.tsx: keys are retained **7 days**; a retry with the same key within that window returns the original order and never creates a duplicate; after 7 days the key is pruned and the request is treated as new; keys should be random UUIDs, up to 255 characters.

## Not changing

- `customer_order_number` dedup (permanent) — stays as is.
- Webhook / Shopify idempotency paths.
- No UI changes.
