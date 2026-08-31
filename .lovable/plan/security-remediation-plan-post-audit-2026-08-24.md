# Security Remediation Plan (post-audit)

Your critique is accepted in full, and one verification changed the priority order: the database check confirms `anon` can execute `get_vault_secret` and `get_cron_secret` with no caller check. That is a direct read of every stored secret from the public API and outranks everything else in the report.

## Confirmed this turn

Anon-executable `SECURITY DEFINER` functions in `public` with no `has_role`/`auth.uid()` guard include:

```text
get_vault_secret          <-- returns arbitrary Vault secrets
get_cron_secret           <-- returns the cron auth secret
create_webhook_secret
verify_api_key
invoke_weekly_invoice_batch, invoke_send_order_updates,
invoke_generate_timeslips, invoke_internal_report,
invoke_process_scheduled_announcements, invoke_refresh_vehicles,
invoke_fuel_finder_refresh
get_public_order, get_public_order_with_proof,
get_public_inspection_summary, get_public_repair_offer,
submit_public_repair_offer   <-- public by design, param-gated
```

The `admin_*` functions do contain guards, so F-10's headline number is mostly benign — but the four secret/credential functions are not. Geoapify is confirmed used from the browser in 6 client files.

`update_user_profile_for_management` is not anon-executable.

## P0 — do first

1. **Revoke anon/authenticated EXECUTE on `get_vault_secret`, `get_cron_secret`, `create_webhook_secret`, `verify_api_key` and all seven `invoke_*` cron wrappers** — grant to `service_role` only. Then rotate every secret reachable through them (service role key, SendZen, QuickBooks, Resend, webhook secrets, cron secret), since exposure must be assumed.
2. **Geoapify**: rotate the key, apply Geoapify-side domain/quota restrictions, then move all six browser call sites behind a single authenticated edge proxy (`geo-proxy`) with per-user rate limiting. Severity is restated as High-with-quota-abuse rather than an automatic Critical, per your point. No replacement `VITE_` variable.
3. **`trigger-webhook`**: not the service-role-key-as-password fix from the report. Make it internal-only — a dedicated `INTERNAL_INVOKE_SECRET` header check, and change the DB trigger `trigger_order_webhook` to be the only caller. External invocation returns 401 regardless of any Supabase key.
4. **`send-announcement-whatsapp`** and the other WhatsApp senders: `requireOpsAuth`.
5. **`cs-inbound-email` / `cs-inbound-whatsapp`**: verify provider signature (Resend/SendZen) before processing; reject unsigned.

## P1

6. **Remove `profiles.role` as an authorisation mechanism entirely** — 9 edge functions still read it. Replace every check with `has_role()`. Record the hard rule: `user_roles` = authority, `has_role()` = check, `profiles.role` = display cache only.
7. Enable RLS on the two flagged tables.
8. **PostgREST filter construction** — reclassify F-08 as "confirmed unsafe construction, impact unvalidated". Fix by passing the email as a bound parameter / separate `.eq()` calls instead of interpolating into `.or()`, and add an escaping test.
9. **Upload validation** — extension + declared MIME + magic-byte sniff + size cap + per-bucket allow-list, private buckets with short-lived signed URLs, SVG rejected.
10. **Audit all 33 `verify_jwt = false` functions** against the endpoint classification below.

## P2

Rate limiting, CORS tightening (drop `*` on authenticated endpoints), `search_path` pinning, extensions out of `public`, CI gates.

## Architectural change: endpoint classification

Every function declares its class in a header comment and in a manifest:

```text
PUBLIC    -> tracking, availability, repair offer, signed provider webhooks
USER      -> valid JWT + ownership/role check
INTERNAL  -> dedicated internal secret only; never reachable from the internet
```

A CI script parses `supabase/config.toml` plus each `index.ts`, and fails the build when a function has `verify_jwt = false` without a declared class, or an `INTERNAL`/`USER` function contains no call to an `_shared/auth.ts` helper.

## Secrets-in-history audit (new task)

A separate task: scan git history, `.env` files, migrations, built bundles and source maps for `SUPABASE_SERVICE_ROLE_KEY`, `SENDZEN_API_KEY`, `LOVABLE_API_KEY`, `QUICKBOOKS_CLIENT_SECRET`, Resend credentials, Geoapify keys, webhook and cron secrets. Anything found in history gets rotated, not deleted.

## Second audit after remediation

Once P0/P1 land, run an adversarial re-audit with the framing you wrote: assume an unauthenticated attacker, enumerate every edge function and RPC reachable without a session, and prove what each can read or change — not merely that the code changed. Output appended to `docs/SECURITY_AUDIT_2026-08-24.md` as a verification section.

## Report edits

Update the audit doc to reflect: the new Critical (anon Vault access), Geoapify severity restated, F-03 remediation replaced with the internal-secret design, F-05 widened to full removal of `profiles.role` authorisation, F-08 downgraded to unvalidated impact, F-10 split into confirmed-dangerous vs guarded vs public-by-design, and the revised P0/P1/P2 ordering.
