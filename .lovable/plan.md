
# Security Hardening: Orders Table Lockdown

The stronger approach is **full lockdown with SECURITY DEFINER RPCs**. It removes all anonymous/broad authenticated access to the `orders` table and routes the two legitimate public flows (tracking page + availability pages) through narrow, column-limited, validated RPC functions.

## Why this is stronger than the middle-ground

- **No PII leakage via tracking number.** Anyone guessing/scraping tracking numbers currently gets all 61 columns (addresses, phones, GPS, bike values, payment fields). A column-limited RPC returns only what the tracking page renders.
- **No mass-update risk.** Currently any signed-in user (and arguably anon) can `UPDATE` any order. RLS alone can't validate a URL-supplied availability secret, so the only correct fix is to move writes into a SECURITY DEFINER RPC that checks the per-order UUID secret server-side.
- **Defense in depth.** Even if a future bug re-exposes a row, the columns returned are minimal and the writable fields are whitelisted.

## Plan

### 1. Database migration

**Drop the unsafe policies on `public.orders`:**
- `orders_public_tracking_select_policy`
- `orders_authenticated_public_select_policy`
- The permissive UPDATE policy (true/true)

**Keep / verify these scoped policies:**
- Admin SELECT/UPDATE (via `has_role`)
- Owner SELECT/UPDATE (`auth.uid() = user_id`)
- Route planner / loader / driver scoped policies
- Revoke direct `SELECT`/`UPDATE` on `public.orders` from `anon`

**Create `public.get_public_tracking(p_tracking text)` — SECURITY DEFINER, returns table:**
Returns only fields the tracking page needs:
```
id, tracking_number, customer_order_number, status,
scheduled_pickup_date, scheduled_delivery_date,
pickup_date, delivery_date,
sender_name, sender_city, sender_postcode,
receiver_name, receiver_city, receiver_postcode,
bikes_summary (count + brand/model only, no value/serial),
order_collected, order_delivered,
collection_confirmation_sent_at,
created_at
```
No addresses, phones, emails, GPS, payment, or financials. Granted EXECUTE to `anon, authenticated`.

**Create `public.get_order_for_availability(p_order_id uuid, p_secret uuid)` — SECURITY DEFINER:**
Validates `p_secret` against the existing per-order secret column (need to confirm column name — likely `availability_token` / similar). Returns only fields the availability forms render.

**Create `public.set_order_availability(p_order_id uuid, p_secret uuid, p_side text, p_payload jsonb)` — SECURITY DEFINER:**
- `p_side` is `'sender'` or `'receiver'`
- Validates secret matches the order
- Whitelists writable fields per side (availability dates/times, contact corrections only — never status, value, financials)
- Performs the `UPDATE`
- Granted EXECUTE to `anon, authenticated`

### 2. Frontend service changes

**`src/services/order/fetchOrderService.ts`**
- `getPublicOrder(tracking)` → `supabase.rpc('get_public_tracking', { p_tracking: tracking })`
- Map the returned row to the shape `TrackingPage` expects.

**`src/services/availabilityService.ts`**
- `getSenderAvailability(orderId, secret)` / `getReceiverAvailability(...)` → `supabase.rpc('get_order_for_availability', ...)`
- `updateSenderAvailability(orderId, secret, payload)` → `supabase.rpc('set_order_availability', { p_order_id, p_secret, p_side: 'sender', p_payload })`
- Same for `updateReceiverAvailability` with `p_side: 'receiver'`

**`src/pages/SenderAvailability.tsx` / `ReceiverAvailability.tsx` / `useAvailability.tsx`**
- No UI changes. Only the service calls underneath change. Forms, validation, toasts, success states all unchanged.

**`src/pages/TrackingPage.tsx`**
- No UI changes. Only data source changes. Any field the page renders that isn't in the RPC return shape gets removed from the page (it shouldn't have been public anyway).

### 3. Verification

- Public tracking page loads with limited data, no PII.
- Sender/receiver availability pages still load and submit via the secret URL.
- Signed-in owner still sees their full order in the dashboard (uses owner policy, not the public path).
- Admin dashboards unaffected.
- Direct `from('orders').select()` from anon session returns 0 rows.
- Direct `from('orders').update()` from a non-owner authenticated session is denied.

## Open questions before I build

1. **Confirm the per-order secret column name** used by the current availability links (so the RPC can validate it). I'll grep for it during implementation if you'd rather I just find it.
2. **Tracking page fields** — OK to drop any sender/receiver address line, phone, email, GPS, and bike value/serial from the public view? (These shouldn't be public.)
3. **Claim-related tables** stay admin-only as today — confirm.

## Impact summary

- **End users:** no visible change.
- **Public scrapers / attackers:** lose PII access and lose ability to mutate orders.
- **Risk:** small — the two public flows are well-isolated and easy to verify after the change.
