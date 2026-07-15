# Prefer `accounts_email` for QuickBooks customer sync

## Change
In both edge functions, resolve the QB email as `accounts_email?.trim() || email?.trim()` and use it for:
- the search lookup (`Customer WHERE PrimaryEmailAddr = ...`)
- the create payload (`PrimaryEmailAddr.Address`)
- the "no email" skip/error guard
- `DisplayName` fallback chain

## Files
- `supabase/functions/create-quickbooks-customer/index.ts`
  - Add `accounts_email` to the `profiles` select.
  - Replace `profile.email` usages with a new `qbEmail` local.
  - Error "Profile has no email" becomes "Profile has no email or accounts email".
- `supabase/functions/backfill-quickbooks-customers/index.ts`
  - Add `accounts_email` to the select.
  - Update the filter so accounts qualify when either `email` OR `accounts_email` is set (currently filters `email IS NOT NULL` only).
  - Use the same `qbEmail` resolution per account; report skipped rows with no email of either kind.

## Not changing
- Frontend UI (button label, "email required" tooltip) — the button remains enabled whenever either email exists; I'll adjust the disabled/tooltip check in `EditUserDialog.tsx` to consider `accounts_email` too so admins can sync accounts that only have an accounts email.
- No schema or type changes.
