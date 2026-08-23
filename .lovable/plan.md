# Lock down the WhatsApp sending endpoints

The security finding flags three endpoints. Two of them (`send-sendzen-whatsapp`, `send-timeslot-whatsapp`) already require a signed-in staff member with an admin, route planner, or loader role — verified in their code. The remaining gap is real: `send-announcement-whatsapp` accepts any request and will send a WhatsApp message from the company number to any phone number supplied.

## What to change

**Add staff authentication to the announcement sender**
- Require a valid signed-in staff session (admin, route planner, or loader) before any message is sent, using the same shared auth helper the other two WhatsApp functions use.
- Also allow internal service-to-service calls (the helper already treats the service key as trusted), so any future scheduled/automated announcement flow keeps working.
- Return 401 for missing/invalid tokens and 403 for signed-in users without a staff role, with CORS headers on every response.

**Callers**
Both existing callers — the announcements page and the bulk route message dialog — invoke the function through the authenticated Supabase client, so the user's session token is already attached. No frontend changes needed; behaviour for staff stays identical.

**Verification**
- Typecheck, then confirm the function still deploys.
- Confirm an unauthenticated request is rejected (401) and that a staff-authenticated send still succeeds.

**Finding**
Once verified, mark `whatsapp_send_no_auth` as fixed and record in security memory that these three WhatsApp senders are staff-gated via the shared ops auth helper, so future scans don't re-raise it.

## Technical notes
- `supabase/functions/send-announcement-whatsapp/index.ts`: import `requireOpsAuth` / `createAuthErrorResponse` from `../_shared/auth.ts`, call it immediately after the OPTIONS preflight branch with roles `['admin','route_planner','loader']`.
- No database or config changes required (`verify_jwt` stays false; validation happens in code).
