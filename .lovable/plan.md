# Shipday Webhook Finding — Re-raised, Still a False Positive

## Current state, verified just now

The webhook function has no "hardcoded false" check. Before it reads the payload or touches the database it:

1. Loads the `SHIPDAY_WEBHOOK_TOKEN` secret and refuses the request outright if it isn't configured.
2. Reads the `token` / `x-webhook-token` header and returns 401 unless it exactly matches that secret.

Only after both pass does it parse the body and update orders. An attacker who knows the URL but not the token gets a 401, so the spoofing the finding describes is not possible.

Earlier this session I also confirmed against live data that genuine Shipday traffic is being accepted (hundreds of tracking events in the last few days, all written by the authenticated webhook path), and I removed the header log line that used to leak the token plus the full-payload log that carried customer details.

## What to do

There is no code change to make — the endpoint is already protected. The scanner has flagged the same issue again, so the action is to dismiss it as a false positive with an explanation, which requires your approval on the security card.

If you'd rather be extra safe, the one optional hardening available is a constant-time token comparison instead of `!==`, which removes a theoretical timing side channel. It is very unlikely to be exploitable across the internet for a random 32-byte token, so I'd leave it unless you want it.

## Notes

- File: `supabase/functions/shipday-webhook/index.ts`.
- `verify_jwt = false` stays — Shipday cannot send a Supabase JWT, so the shared token header is the correct mechanism.
- The security memory already records this endpoint as token-authenticated so future scans shouldn't re-raise it; approving the dismissal reinforces that.
