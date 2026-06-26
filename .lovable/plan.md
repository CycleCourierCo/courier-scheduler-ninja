## Root cause

When a sender confirms availability, the `set_order_availability` SQL function already dispatches the receiver email server-side via `pg_net.http_post` to the `send-email` edge function (this is the existing server-side path — not new). For order `CCC754873966117SAMPR8` that POST returned **401 Unauthorized** and no receiver email was sent.

Why: the RPC posts `emailType: 'receiver_availability'`, but `supabase/functions/send-email/index.ts` only treats these strings as public (no-auth):

```
const publicEmailTypes = ['sender', 'receiver', 'sender_dates_confirmed', 'receiver_dates_confirmed'];
```

`'receiver_availability'` is not in that list, so the request falls through to `requireAuth(req)`. The `pg_net` call only carries the anon key (no user JWT, not the service-role key), so auth fails with 401. On top of that, the template router only knows `'sender' | 'receiver' | ...'_dates_confirmed'` — there's no branch for `'receiver_availability'`, so even with auth it would render nothing useful.

This has been silently broken since the server-side dispatch was added — receivers only got the email when the sender's browser tab stayed open long enough for the client-side `resendReceiverAvailabilityEmail` fallback to also run.

## Fix

One-line change inside `set_order_availability`: change the `pg_net.http_post` body from `'emailType': 'receiver_availability'` to `'emailType': 'receiver'`, matching:
- the existing `publicEmailTypes` allow-list (so no 401),
- the existing template branch already used by the client-side path (so the email is identical to what users get today when their tab stays open).

No edge function code, RLS, or grants change. Client-side `resendReceiverAvailabilityEmail` stays as a redundant backup.

## Verification

1. On a test order, confirm sender availability while immediately closing the tab.
2. Check `net._http_response` — most recent call to `/functions/v1/send-email` should be `200`, not `401`.
3. Check `email_delivery_events` for the order — a new row with `side='receiver'`, `email_type='receiver_availability'`, `event_type='sent'` (followed by `delivered`, etc.) should appear within seconds.
4. For the stuck order `CCC754873966117SAMPR8`, manually click "Resend Receiver Email" from the order detail page so the receiver finally gets it.
