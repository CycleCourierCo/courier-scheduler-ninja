# Backfill missing sender/receiver contact links on orders (SQL)

Run a one-off SQL script to link the 21 orders missing `sender_contact_id` and/or `receiver_contact_id` to records in `contacts`, creating contacts where none exist.

## Scope
- 17 orders missing sender contact
- 19 orders missing receiver contact
- 15 missing both
- 21 distinct orders total

## SQL approach

Single transaction, two passes (sender then receiver). For each pass:

1. **Insert missing contacts** — `INSERT INTO contacts (user_id, name, email, phone, street, city, state, postal_code, country, lat, lon)` selecting from `orders` where the side's contact id is null AND `sender->>'email'` (or receiver) is non-empty, with `ON CONFLICT (user_id, email) DO UPDATE` so existing rows get refreshed name/phone/address.

2. **Link contact id back onto the order** — `UPDATE orders SET sender_contact_id = c.id FROM contacts c WHERE orders.user_id = c.user_id AND lower(orders.sender->>'email') = lower(c.email::text) AND orders.sender_contact_id IS NULL`. Repeat for receiver.

Email normalised with `lower(trim(...))`; `contacts.email` is CITEXT so the join is case-insensitive.

## Reported afterwards
A final `SELECT` returns:
- Orders still missing sender/receiver link (i.e. snapshot had no email) — for manual review.
- Count of contacts inserted vs updated (via `xmax = 0` trick on the upsert).

## Out of scope
- No schema changes.
- No edge function, no code changes.
- Orders with no email on the JSON snapshot stay unlinked and appear in the leftover report.
