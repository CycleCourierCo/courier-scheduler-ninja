## What I verified

- The `get_public_order` RPC works correctly for the anonymous role. A direct REST call from the `anon` key returns a full sanitised payload for a real tracking number (`CCC754187402266CHRWA9`).
- `EXECUTE` is granted to `anon`, `authenticated`, and `service_role` on both `get_public_order` and `get_public_inspection_summary`.
- The browser console shows `TrackingPage order data: null` — meaning the RPC ran and returned `null`, i.e. the identifier did not match any row.

So the backend is reachable; what's broken is the lookup itself. The most likely causes, in order:

1. **Whitespace / case in the input.** `TrackingForm` passes the raw input directly to `getPublicOrder`. The RPC compares with `=` (case‑sensitive, no trim). A trailing space or wrong case ("ccc754…") returns null. The old direct‑table query happened to work for some users because the previous policies tolerated different lookup paths.
2. **Identifier the page is using.** The form uses whatever the user types; if they paste an internal UUID or a non‑existent `customer_order_number`, it now silently returns null. The previous `orders_public_tracking_select_policy` may have been broader.
3. **Tracking links from emails.** Anywhere we constructed `/tracking/{id}` using `order.id` (UUID) will still work — the RPC accepts UUID, tracking number, or customer order number. But links built with another identifier (e.g. `bike_id`, internal reference) would now fail. Need to grep email templates / edge functions for `/tracking/` link construction.

## Plan

### 1. Reproduce against the live preview (no code yet)
- Drive Playwright as an anonymous (signed‑out) user to `/tracking/CCC754187402266CHRWA9` and to `/tracking` + form submit, capture screenshots + network responses. Confirm whether the page renders the order or shows "No order found".
- Try one real `customer_order_number` value and one UUID to make sure all three lookup branches in the RPC work end‑to‑end via the browser.

### 2. Harden the RPC lookup (small migration)
Update `public.get_public_order(p_identifier text)` so it:
- `trim()`s the input and rejects empty strings after trimming.
- Compares case‑insensitively for `tracking_number` and `customer_order_number` (`lower(tracking_number) = lower(trim(p_identifier))`).
- Keeps the strict UUID regex check for the `id` branch.

This matches user expectations ("paste the order number from the email") and removes the silent‑null class of bugs.

### 3. Harden the client
In `TrackingForm` / `getPublicOrder`:
- Trim the input before navigating and before the RPC call.
- When the RPC returns null, show the existing "No order found" card immediately instead of leaving the user staring at a spinner.
- Add a single `console.warn` with the RPC error (if any) so future regressions are visible in logs without leaking PII.

### 4. Verify the inspection summary still attaches for anon
The RPC already inlines `inspection_summary` when `needs_inspection` is true. Confirm via Playwright on a tracking number that has an inspection. No code change expected; this is just a verification step.

### 5. Audit outgoing tracking links
Grep `supabase/functions/**` and email templates for `/tracking/${...}` to confirm every link uses one of: `order.id`, `tracking_number`, or `customer_order_number`. Anything else gets switched to one of those three.

## Questions before I implement

1. Can you share the exact URL or the order ID you typed when the page failed? That will tell me immediately whether it's the trimming/case issue or something more fundamental.
2. Are you OK with making tracking number and customer order number lookups **case‑insensitive** for the public tracking page? (UUID lookup stays strict.)
