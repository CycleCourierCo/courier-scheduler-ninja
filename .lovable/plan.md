# Backfill QuickBooks Customer IDs for Existing B2B Accounts

## Current state
- `profiles.quickbooks_customer_id` exists but is NULL for all 123 business accounts (115 approved).
- Nothing runs retroactively — only new approvals and the manual button populate it.

## Goal
Link every existing approved B2B profile to a QuickBooks customer, creating one when no match exists, using the same rules as the per-account button.

## Approach

Add a new admin-only edge function `backfill-quickbooks-customers` that reuses the token + refresh + search/create logic from `create-quickbooks-customer`.

Behaviour:
- Load all `profiles` where `is_business = true`, `account_status = 'approved'`, `quickbooks_customer_id IS NULL`, and `email IS NOT NULL`.
- For each profile, sequentially (to respect QuickBooks rate limits):
  1. `SELECT * FROM Customer WHERE PrimaryEmailAddr = '<email>'` — if found, save the ID.
  2. Otherwise POST `/customer` with the same payload (DisplayName, CompanyName, GivenName/FamilyName, PrimaryEmailAddr, PrimaryPhone, WebAddr, BillAddr with UK country) and save the returned ID.
  3. Small delay (~150ms) between accounts.
- Collect per-account results: `{ userId, email, status: 'linked' | 'created' | 'skipped' | 'error', customerId?, error? }`.
- Return a summary `{ linked, created, skipped, errors, details }`.

Trigger: a **"Backfill QuickBooks customers"** button on the Account Approvals page, admin only. Shows a confirmation dialog first (since it can create many QB customers), then a toast with the summary counts once it finishes. Errors are logged in the function output for review.

Missing-email profiles are skipped and reported (not treated as failures).

## Notes
- Runs synchronously in one edge function invocation. 115 accounts × ~2 QB round-trips ≈ well under the edge function timeout.
- Idempotent — re-running only processes accounts still missing `quickbooks_customer_id`, so it's safe to retry after errors.
- No schema changes needed; column already exists.
