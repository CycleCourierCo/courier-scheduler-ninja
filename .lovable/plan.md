No — I need the **Webhook Signing Secret**, not the Resend API key.

## Where to find it

1. Go to Resend → **Webhooks** (not API Keys).
2. Click the webhook endpoint that points at `…/functions/v1/resend-webhook`.
3. Look for **Signing Secret**. It starts with `whsec_…`.
4. Copy that value and paste it into `RESEND_WEBHOOK_SECRET`.

## Why this one

The `resend-webhook` edge function uses Svix to verify the `svix-signature` header on each incoming event. That verification only works against the endpoint's signing secret. The Resend API key (starts with `re_…`) is for *sending* email from our side — it can't verify inbound webhook signatures, so using it will keep every event failing with `invalid signature` and no `delivered`/`opened`/`clicked` rows will be recorded.

Once you confirm, I'll trigger the secret update prompt so you can paste the `whsec_…` value.
