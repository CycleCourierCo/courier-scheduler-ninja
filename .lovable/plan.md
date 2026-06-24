## Goal
Add non-sensitive diagnostic logging to the `resend-webhook` edge function so we can see why Resend signatures aren't verifying — without ever printing the signing secret in full.

## Changes (single file: `supabase/functions/resend-webhook/index.ts`)

On every incoming request, log:
- `svix-id` (full — not secret)
- `svix-timestamp` (full)
- `svix-signature` header **length** and **first 12 chars** only (the header itself is a signature, not a secret, but keeping it partial is safer)
- Payload **byte length**
- Whether `RESEND_WEBHOOK_SECRET` is set, its **length**, and its **first 6 chars** (e.g. `whsec_…`) — enough to confirm it starts with `whsec_` and isn't truncated, without exposing the secret
- Whether `verify()` passed or failed, plus the Svix error message on failure (Svix errors are descriptive: "no matching signature found", "timestamp too old", "secret not in correct format", etc.)
- On success: the event `type` (e.g. `email.delivered`)

## What we will NOT log
- Full signing secret
- Full svix-signature value
- Full payload body
- Recipient emails or message content

## After deploy
1. Trigger a test event from Resend (or wait for the next real one).
2. Read the `resend-webhook` logs — the Svix error message will tell us precisely whether it's a wrong secret, a different endpoint's secret, a clock skew, or malformed header.
3. Based on what we see, either fix the secret value or adjust the verification path.

No database or other functions touched.