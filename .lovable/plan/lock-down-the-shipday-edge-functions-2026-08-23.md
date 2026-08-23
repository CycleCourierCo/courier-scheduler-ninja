# Lock down the Shipday edge functions

## What the audit found (verified)

Functions that talk to Shipday and their current gate:

| Function | Who calls it | Current auth |
|---|---|---|
| create-shipday-order | staff UI, plus internal calls from the public orders API, the Shipday webhook and the reconcile job | none |
| delete-shipday-order | staff UI (order detail, Northern Ireland panel) | none |
| verify-shipday-orders | Job Scheduling page | none |
| query-shipday-completed-orders | nothing in the codebase | none |
| send-timeslot-whatsapp / send-sendzen-whatsapp (both edit live Shipday orders) | staff UI | none |
| get-shipday-carriers | staff UI | signed-in user only |
| reconcile-shipday-orders | admin trigger | admin role checked — already correct |
| shipday-webhook | Shipday | shared webhook token checked — already correct |

So anyone with the URL can create, delete or edit Shipday jobs today.

## What to change

1. Add one shared gate that accepts either (a) an internal call from another edge function using the service key, or (b) a signed-in staff member with an operations role (admin, route planner, driver where relevant, loader). Anything else gets a 401/403.
2. Apply it:
   - create-shipday-order: internal-or-staff (admin / route planner).
   - delete-shipday-order: staff only (admin / route planner).
   - verify-shipday-orders: staff only (admin / route planner).
   - send-timeslot-whatsapp and send-sendzen-whatsapp: staff only (admin / route planner / loader), since they push edits into Shipday and message customers.
   - get-shipday-carriers: upgrade from "any signed-in user" to staff roles (this also clears the separate "any customer can list drivers" warning).
3. Delete query-shipday-completed-orders — nothing calls it and it exposes customer and driver details unauthenticated. If you would rather keep it, it gets the staff gate instead.
4. Confirm the three internal invocations (public orders API, Shipday webhook, reconcile job) keep working, since they already call out with the service key.
5. Frontend calls need no change — `supabase.functions.invoke` already sends the signed-in user's token.
6. Mark the Shipday auth findings as fixed afterwards.

## Technical notes

- New helper `requireShipdayOpsAuth(req, roles)` in `supabase/functions/_shared/auth.ts`: first compares the bearer token to `SUPABASE_SERVICE_ROLE_KEY` for internal calls, otherwise validates the JWT and checks roles via the existing `has_role` RPC. Errors returned through `createAuthErrorResponse` so CORS headers stay intact.
- OPTIONS preflight handling stays ahead of the auth check in each function.
- `verify_jwt = false` stays as-is in `supabase/config.toml`; validation happens in code per project convention.

## Out of scope (still open, tell me if you want them next)

Other unauthenticated endpoints flagged by the scanner: the public orders GET endpoint, QuickBooks bill creation, webhook trigger, the exposed Geoapify and TrackPod keys, the sales-role privilege escalation, and the delivery-photo read policy.
