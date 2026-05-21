# Backfill missing sender/receiver contact links on orders

Link the 21 orders currently missing a `sender_contact_id` and/or `receiver_contact_id` to records in the `contacts` table, creating contacts where none exist.

## Scope
- 17 orders missing sender contact
- 19 orders missing receiver contact
- 15 missing both
- Total: 21 distinct orders (Mar–May 2026)

## Approach

One-off Supabase edge function `backfill-order-contacts` (admin-invoked, no schedule):

1. Query `orders` where `sender_contact_id IS NULL OR receiver_contact_id IS NULL`.
2. For each order and each missing side (sender/receiver):
   - Read the snapshot from `orders.sender` / `orders.receiver` JSONB (name, email, phone, address).
   - Skip if no email on the snapshot (can't reliably upsert) — log and continue.
   - Call the same `upsertContact` logic used at order creation: match by `user_id + lower(email)`, insert if missing, update fields otherwise.
   - Update the order with the resulting `sender_contact_id` / `receiver_contact_id`.
3. Return a JSON summary: processed, linked, skipped (no email), errors.

## Technical notes
- Uses service role inside the edge function (bypasses RLS for the cross-user update).
- Address fields and lat/lon copied from order snapshot; no re-geocoding (snapshot is source of truth).
- Email normalised to lowercase + trimmed before upsert; `contacts.email` is CITEXT so case is handled.
- Idempotent: re-running only touches orders still missing a link.
- Invoked once manually from the Supabase dashboard or via `supabase.functions.invoke('backfill-order-contacts')` from an admin page — no UI added.

## Out of scope
- No schema changes.
- No changes to order-creation flow (it already upserts correctly going forward).
- Orders with no email on the snapshot will remain unlinked and be reported in the summary for manual review.
