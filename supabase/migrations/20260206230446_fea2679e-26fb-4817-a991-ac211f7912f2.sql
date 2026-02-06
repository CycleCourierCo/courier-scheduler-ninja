-- Backfill: Link sender contacts to existing orders
UPDATE orders o
SET sender_contact_id = c.id
FROM contacts c
WHERE o.user_id = c.user_id
  AND o.sender_contact_id IS NULL
  AND o.sender->>'email' IS NOT NULL
  AND LOWER(o.sender->>'email') = LOWER(c.email::text);

-- Backfill: Link receiver contacts to existing orders
UPDATE orders o
SET receiver_contact_id = c.id
FROM contacts c
WHERE o.user_id = c.user_id
  AND o.receiver_contact_id IS NULL
  AND o.receiver->>'email' IS NOT NULL
  AND LOWER(o.receiver->>'email') = LOWER(c.email::text);