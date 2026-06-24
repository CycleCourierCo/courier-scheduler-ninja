## Goal

Make the `orders` POST return in well under a second and eliminate timeout-retry duplicates.

## Current sequential cost (worst case)

1. Verify API key — ~100ms
2. Generate tracking number (invoke edge fn) — 300–800ms
3. Geocode sender + receiver (2 Geoapify calls) — 500–2000ms
4. Insert order row — 100ms
5. Upsert sender + receiver contacts — 200–400ms
6. Send 3 emails (3 × invoke `send-email` → Resend) — 1500–4500ms
7. Invoke `create-shipday-order` (calls Shipday) — 1000–5000ms

Total: easily 5–13s, which exceeds many client/proxy timeouts. Caller retries → duplicate order (confirmed in DB for orders 5691 and 5553).

## Fix — two changes to `supabase/functions/orders/index.ts`

### 1. Idempotency guard (prevents duplicates even if retried)

Right after API key verification, if `customer_order_number` is present, look up `(user_id, customer_order_number)`. If found, return that existing order (200) instead of inserting a new one. Retries become safe no matter what.

### 2. Respond fast, do everything else in the background

Keep in the request path (must happen before response so we can return a real order):

- API key verification
- Idempotency lookup
- Tracking number generation
- Order insert (with `status: 'created'`, no coords yet)

Move to `EdgeRuntime.waitUntil(...)` background task (runs after the 201 is sent):

- Geocoding sender + receiver, then `UPDATE orders` with lat/lon
- Contact upsert + linking
- All 3 `send-email` invocations
- `create-shipday-order` invocation

Expected response time after change: ~400–900ms instead of 5–13s.

### Why this is safe

- The order row exists immediately, so the caller gets a valid `id` and `tracking_number` they can use right away.
- Background failures are logged (Sentry + console) but don't affect the caller. Emails and Shipday are already wrapped in try/catch today and treated as non-fatal — moving them to a background task keeps that semantics.
- Geocoding being deferred means lat/lon may be missing for a few seconds after creation; routing/scheduling already tolerates this (orders get geocoded by other flows too).

## Scope

- Only `supabase/functions/orders/index.ts`.
- No schema changes, no other edge functions, no frontend.
- Existing duplicate rows are not cleaned up in this change.
