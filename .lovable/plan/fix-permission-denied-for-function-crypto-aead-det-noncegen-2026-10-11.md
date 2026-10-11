# Fix: "permission denied for function _crypto_aead_det_noncegen" when saving a partner app webhook

## Problem
Saving a webhook address on the Partner Apps page fails with `permission denied for function _crypto_aead_det_noncegen`.

Root cause (confirmed by querying the database): `admin_set_oauth_client_webhook` is a SECURITY DEFINER function owned by `postgres`. When it stores the new webhook secret it inserts into `vault.secrets`, which internally calls the vault encryption helpers `_crypto_aead_det_noncegen` / `_crypto_aead_det_encrypt`. Those helpers are owned by `supabase_admin` and granted to **no one else**, so the `postgres` role is denied and the save fails.

## Fix
One small migration that grants the vault encryption helpers to the roles that need them:

```sql
GRANT EXECUTE ON FUNCTION vault._crypto_aead_det_noncegen() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION vault._crypto_aead_det_encrypt(bytea, bytea, bytea, bytea) TO postgres, service_role;
```

(Exact signatures confirmed against the live database before writing the migration; grants are scoped to the two internal helpers only — nothing else in the vault schema is touched.)

## Verify
- Re-run the save from the Partner Apps page (or via `supabase--read_query` calling `admin_set_oauth_client_webhook` as an admin) and confirm it returns a secret instead of the permission error.
- Confirm VeloDealer's webhook row shows the saved URL and secret prefix.

## Notes
- No code changes needed; the function logic is correct, only the database grants were missing.
- After this, VeloDealer's webhook (`https://api.velodealer.com/functions/v1/cycle-courier-webhook`) can be saved and order updates will fan out to it for connected customers.
