# Fix customer-service access to claims

## Confirmed cause

Jabir Hussain’s account is approved and has the `cs_agent` role in `user_roles`. The application sends his authenticated user ID as `claims.created_by`, but the live database currently:

- allows only `admin` through RLS on `claims`, `claim_notes`, `claim_evidence_files`, and `claim_status_log`;
- allows only `admin` through Storage policies for the private `claim-evidence` bucket;
- has no Data API table grants for the claims tables.

This is why creating a claim produces the reported row-level security error. Fixing only the initial insert would leave claim details, notes, status history, and evidence broken for customer-service users.

## Changes

1. Add the required authenticated Data API grants for the four claims tables, limited to the operations used by the app.
2. Replace the admin-only claims policies with internal claims-team policies that allow either `admin` or `cs_agent`:
   - full claim viewing, creation, and updates;
   - note viewing and creation;
   - evidence metadata viewing, creation, and deletion;
   - status-log viewing (writes remain trigger-controlled).
3. Extend the private `claim-evidence` Storage policies to the same two roles for upload, view, update, and delete.
4. Keep all checks server-enforced through `has_role(auth.uid(), ...)`; do not trust the profile’s legacy role field or client-supplied ownership.
5. Run the Supabase security linter after the migration.

## Verification

- Sign the preview in as Jabir and create a real claim through `/claims/new`.
- Confirm the stored `created_by` equals Jabir’s authenticated user ID.
- Open the created claim and verify notes, status history, and evidence access.
- Attempt a direct insert with a different `created_by`; the submitted owner must not be accepted. If necessary, add a database ownership trigger/default so authenticated claim creation always derives ownership from `auth.uid()`.
- Confirm a user without `admin` or `cs_agent` remains denied.
- Report authenticated verification separately; if Jabir’s signed-in session cannot be exercised, mark it `Authenticated path: UNVERIFIED`.
