

## Backfill Missing Contacts from Historical Orders

### Problem
179 orders lack contact records because they were created before the contacts feature existed. Those sender/receiver details live only in the order JSONB and never appear in the address book dropdown.

### Solution
Run a one-time database migration that extracts sender and receiver details from orders missing contact links, inserts them into the `contacts` table (respecting the existing `user_id + email` unique constraint), and backfills the `sender_contact_id` / `receiver_contact_id` on those orders.

### Changes

| File | Change |
|---|---|
| **Database migration** | SQL script that: (1) Inserts missing sender contacts from orders where `sender_contact_id IS NULL` and sender email exists, using `ON CONFLICT (user_id, email) DO NOTHING`. (2) Same for receivers. (3) Updates `sender_contact_id` and `receiver_contact_id` on orders by matching `user_id + email` against the contacts table. |

### Migration detail

```sql
-- Step 1: Insert missing sender contacts
INSERT INTO contacts (user_id, name, email, phone, street, city, state, postal_code, country)
SELECT DISTINCT ON (o.user_id, lower(o.sender->>'email'))
  o.user_id,
  o.sender->>'name',
  lower(o.sender->>'email'),
  o.sender->>'phone',
  o.sender->'address'->>'street',
  o.sender->'address'->>'city',
  o.sender->'address'->>'state',
  o.sender->'address'->>'zipCode',
  o.sender->'address'->>'country'
FROM orders o
WHERE o.sender_contact_id IS NULL
  AND o.sender->>'email' IS NOT NULL
  AND trim(o.sender->>'email') != ''
ON CONFLICT (user_id, email) DO NOTHING;

-- Step 2: Insert missing receiver contacts (same pattern)

-- Step 3: Backfill sender_contact_id on orders
UPDATE orders o
SET sender_contact_id = c.id
FROM contacts c
WHERE o.sender_contact_id IS NULL
  AND c.user_id = o.user_id
  AND lower(c.email::text) = lower(o.sender->>'email');

-- Step 4: Backfill receiver_contact_id on orders (same pattern)
```

No code changes needed — this is a data-only migration. After running, all historical contacts will appear in the address book dropdown.

