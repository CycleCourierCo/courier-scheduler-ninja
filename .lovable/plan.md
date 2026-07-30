## Where those secrets come from

They aren't issued by any third party — they are **shared secrets you invent once** and paste into **both** projects. bike-checker-pro's `COURIER_API_KEY` / `COURIER_SYNC_SECRET` must exactly match this portal's `INSPECTABIKE_API_KEY` / `INSPECTABIKE_SYNC_SECRET`.

Confirmed current state: this portal's edge functions read `INSPECTABIKE_BASE_URL`, `INSPECTABIKE_API_KEY`, `INSPECTABIKE_SYNC_SECRET` (in `supabase/functions/_shared/inspectabike.ts`), and none of those three are configured yet in this project's secrets.

## What each one does

- `API_KEY` — bearer token the portal sends when calling InspectaBike (create inspection, push fault status).
- `SYNC_SECRET` — HMAC key used to sign/verify the inbound fault webhook, so InspectaBike's pushes can be trusted.

## Steps

1. Generate two strong random values (password manager, or `openssl rand -hex 32` twice). Keep them side by side — you'll paste each twice.
2. In **bike-checker-pro**, submit the form it's showing:
   - `COURIER_API_KEY` = value A
   - `COURIER_SYNC_SECRET` = value B
   - It will also need `COURIER_WEBHOOK_URL` = `https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/inspectabike-fault-webhook`
3. Back in **this portal**, I'll open a secure form for:
   - `INSPECTABIKE_API_KEY` = value A (same as above)
   - `INSPECTABIKE_SYNC_SECRET` = value B (same as above)
   - `INSPECTABIKE_BASE_URL` = bike-checker-pro's functions base URL, i.e. `https://<its-supabase-ref>.supabase.co/functions/v1`
4. Then a quick end-to-end check: hit "Send to InspectaBike" on one inspection, confirm the external id + report link land, and confirm a test fault comes back through the webhook and prices from the labour catalogue.

## Note

Do not use Lovable's auto-generated secret feature for these — generated values are never revealed, so you couldn't copy the same value into the second project. Generate them yourself.
