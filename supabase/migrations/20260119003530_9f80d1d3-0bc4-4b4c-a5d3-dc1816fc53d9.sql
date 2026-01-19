-- Enable CITEXT extension for case-insensitive email
CREATE EXTENSION IF NOT EXISTS citext;

-- Convert email column to CITEXT
ALTER TABLE public.contacts ALTER COLUMN email TYPE citext;

-- Drop existing index and create new one with consistent naming
DROP INDEX IF EXISTS public.idx_contacts_user_email;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_email_unique
ON public.contacts (user_id, email)
WHERE email IS NOT NULL;

-- Insert/Update Sender Contacts
INSERT INTO public.contacts (user_id, name, email, phone, street, city, state, postal_code, country, lat, lon)
SELECT user_id, name, email, phone, street, city, state, postal_code, country, lat, lon
FROM (
  SELECT DISTINCT ON (o.user_id, (o.sender->>'email')::citext)
    o.user_id,
    NULLIF(o.sender->>'name', '') AS name,
    NULLIF(o.sender->>'email', '')::citext AS email,
    NULLIF(o.sender->>'phone', '') AS phone,
    NULLIF(o.sender->'address'->>'street', '') AS street,
    NULLIF(o.sender->'address'->>'city', '') AS city,
    NULLIF(o.sender->'address'->>'state', '') AS state,
    NULLIF(o.sender->'address'->>'zipCode', '') AS postal_code,
    COALESCE(NULLIF(o.sender->'address'->>'country', ''), 'United Kingdom') AS country,
    NULLIF(o.sender->'address'->>'lat', '')::double precision AS lat,
    NULLIF(o.sender->'address'->>'lon', '')::double precision AS lon
  FROM public.orders o
  WHERE o.sender IS NOT NULL
    AND o.user_id IS NOT NULL
    AND o.sender->>'email' IS NOT NULL
    AND o.sender->>'email' <> ''
  ORDER BY o.user_id, (o.sender->>'email')::citext, o.created_at DESC NULLS LAST
) AS deduped_senders
ON CONFLICT (user_id, email) WHERE email IS NOT NULL
DO UPDATE SET
  name = COALESCE(NULLIF(public.contacts.name, ''), EXCLUDED.name),
  phone = COALESCE(NULLIF(public.contacts.phone, ''), EXCLUDED.phone),
  street = COALESCE(NULLIF(public.contacts.street, ''), EXCLUDED.street),
  city = COALESCE(NULLIF(public.contacts.city, ''), EXCLUDED.city),
  state = COALESCE(NULLIF(public.contacts.state, ''), EXCLUDED.state),
  postal_code = COALESCE(NULLIF(public.contacts.postal_code, ''), EXCLUDED.postal_code),
  country = COALESCE(NULLIF(public.contacts.country, ''), EXCLUDED.country),
  lat = COALESCE(public.contacts.lat, EXCLUDED.lat),
  lon = COALESCE(public.contacts.lon, EXCLUDED.lon),
  updated_at = NOW();

-- Insert/Update Receiver Contacts
INSERT INTO public.contacts (user_id, name, email, phone, street, city, state, postal_code, country, lat, lon)
SELECT user_id, name, email, phone, street, city, state, postal_code, country, lat, lon
FROM (
  SELECT DISTINCT ON (o.user_id, (o.receiver->>'email')::citext)
    o.user_id,
    NULLIF(o.receiver->>'name', '') AS name,
    NULLIF(o.receiver->>'email', '')::citext AS email,
    NULLIF(o.receiver->>'phone', '') AS phone,
    NULLIF(o.receiver->'address'->>'street', '') AS street,
    NULLIF(o.receiver->'address'->>'city', '') AS city,
    NULLIF(o.receiver->'address'->>'state', '') AS state,
    NULLIF(o.receiver->'address'->>'zipCode', '') AS postal_code,
    COALESCE(NULLIF(o.receiver->'address'->>'country', ''), 'United Kingdom') AS country,
    NULLIF(o.receiver->'address'->>'lat', '')::double precision AS lat,
    NULLIF(o.receiver->'address'->>'lon', '')::double precision AS lon
  FROM public.orders o
  WHERE o.receiver IS NOT NULL
    AND o.user_id IS NOT NULL
    AND o.receiver->>'email' IS NOT NULL
    AND o.receiver->>'email' <> ''
  ORDER BY o.user_id, (o.receiver->>'email')::citext, o.created_at DESC NULLS LAST
) AS deduped_receivers
ON CONFLICT (user_id, email) WHERE email IS NOT NULL
DO UPDATE SET
  name = COALESCE(NULLIF(public.contacts.name, ''), EXCLUDED.name),
  phone = COALESCE(NULLIF(public.contacts.phone, ''), EXCLUDED.phone),
  street = COALESCE(NULLIF(public.contacts.street, ''), EXCLUDED.street),
  city = COALESCE(NULLIF(public.contacts.city, ''), EXCLUDED.city),
  state = COALESCE(NULLIF(public.contacts.state, ''), EXCLUDED.state),
  postal_code = COALESCE(NULLIF(public.contacts.postal_code, ''), EXCLUDED.postal_code),
  country = COALESCE(NULLIF(public.contacts.country, ''), EXCLUDED.country),
  lat = COALESCE(public.contacts.lat, EXCLUDED.lat),
  lon = COALESCE(public.contacts.lon, EXCLUDED.lon),
  updated_at = NOW();

-- Backfill orders.sender_contact_id
UPDATE public.orders o
SET sender_contact_id = c.id
FROM public.contacts c
WHERE o.user_id = c.user_id
  AND o.sender_contact_id IS NULL
  AND o.sender->>'email' IS NOT NULL
  AND o.sender->>'email' <> ''
  AND (o.sender->>'email')::citext = c.email;

-- Backfill orders.receiver_contact_id
UPDATE public.orders o
SET receiver_contact_id = c.id
FROM public.contacts c
WHERE o.user_id = c.user_id
  AND o.receiver_contact_id IS NULL
  AND o.receiver->>'email' IS NOT NULL
  AND o.receiver->>'email' <> ''
  AND (o.receiver->>'email')::citext = c.email;