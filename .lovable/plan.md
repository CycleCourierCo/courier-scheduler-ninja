# Fix: Jabir gets "Failed to send loading list"

## Root cause
The `send-loading-list-whatsapp` edge function is gated by `requireAdminAuth()`, which requires the `admin` role. Jabir has `route_planner, sales, loader, mechanic, timeslip_admin` but not `admin`, so the function returns **403 Forbidden** and the UI shows "Failed to send loading list".

## Fix
Broaden the auth check on `send-loading-list-whatsapp` to allow the roles that actually operate the Loading & Unloading page.

### Changes
1. **`supabase/functions/_shared/auth.ts`** — add a small helper `requireLoadingListAuth(req)` that accepts any of: `admin`, `route_planner`, `loader`. (Mirrors the pattern of `requireAdminOrRoutePlannerAuth`.) Returns 403 otherwise.
2. **`supabase/functions/send-loading-list-whatsapp/index.ts`** — replace the `requireAdminAuth` call with `requireLoadingListAuth`. No other logic changes.

No frontend changes required. No DB / RLS changes. No other edge functions touched.

## Verification
- Jabir (loader + route_planner) can press **Send Loading List** without the 403 toast.
- A logged-out / customer user still receives 401/403.
- Admin behaviour unchanged.
