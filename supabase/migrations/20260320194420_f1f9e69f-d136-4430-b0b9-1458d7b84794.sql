
-- Step 1: Insert missing sender contacts
INSERT INTO public.contacts (user_id, name, email, phone, street, city, state, postal_code, country)
SELECT DISTINCT ON (o.user_id, lower(o.sender->>'email'))
  o.user_id,
  COALESCE(o.sender->>'name', 'Unknown'),
  lower(o.sender->>'email'),
  o.sender->>'phone',
  o.sender->'address'->>'street',
  o.sender->'address'->>'city',
  o.sender->'address'->>'state',
  o.sender->'address'->>'zipCode',
  o.sender->'address'->>'country'
FROM public.orders o
WHERE o.sender_contact_id IS NULL
  AND o.sender->>'email' IS NOT NULL
  AND trim(o.sender->>'email') != ''
ORDER BY o.user_id, lower(o.sender->>'email'), o.created_at DESC
ON CONFLICT (user_id, email) DO NOTHING;

-- Step 2: Insert missing receiver contacts
INSERT INTO public.contacts (user_id, name, email, phone, street, city, state, postal_code, country)
SELECT DISTINCT ON (o.user_id, lower(o.receiver->>'email'))
  o.user_id,
  COALESCE(o.receiver->>'name', 'Unknown'),
  lower(o.receiver->>'email'),
  o.receiver->>'phone',
  o.receiver->'address'->>'street',
  o.receiver->'address'->>'city',
  o.receiver->'address'->>'state',
  o.receiver->'address'->>'zipCode',
  o.receiver->'address'->>'country'
FROM public.orders o
WHERE o.receiver_contact_id IS NULL
  AND o.receiver->>'email' IS NOT NULL
  AND trim(o.receiver->>'email') != ''
ORDER BY o.user_id, lower(o.receiver->>'email'), o.created_at DESC
ON CONFLICT (user_id, email) DO NOTHING;

-- Step 3: Backfill sender_contact_id on orders
UPDATE public.orders o
SET sender_contact_id = c.id
FROM public.contacts c
WHERE o.sender_contact_id IS NULL
  AND c.user_id = o.user_id
  AND lower(c.email::text) = lower(o.sender->>'email');

-- Step 4: Backfill receiver_contact_id on orders
UPDATE public.orders o
SET receiver_contact_id = c.id
FROM public.contacts c
WHERE o.receiver_contact_id IS NULL
  AND c.user_id = o.user_id
  AND lower(c.email::text) = lower(o.receiver->>'email');
