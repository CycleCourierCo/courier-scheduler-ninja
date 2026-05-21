-- Pass 1: sender contacts (deduped per user_id+email)
INSERT INTO contacts (user_id, name, email, phone, street, city, state, postal_code, country, lat, lon)
SELECT DISTINCT ON (user_id, email) user_id, name, email, phone, street, city, state, postal_code, country, lat, lon
FROM (
  SELECT
    o.user_id,
    NULLIF(trim(o.sender->>'name'), '') AS name,
    lower(trim(o.sender->>'email'))::citext AS email,
    NULLIF(trim(o.sender->>'phone'), '') AS phone,
    NULLIF(trim(o.sender->'address'->>'street'), '') AS street,
    NULLIF(trim(o.sender->'address'->>'city'), '') AS city,
    NULLIF(trim(o.sender->'address'->>'state'), '') AS state,
    NULLIF(trim(o.sender->'address'->>'zipCode'), '') AS postal_code,
    COALESCE(NULLIF(trim(o.sender->'address'->>'country'), ''), 'United Kingdom') AS country,
    NULLIF(o.sender->'address'->>'lat','')::double precision AS lat,
    NULLIF(o.sender->'address'->>'lon','')::double precision AS lon,
    o.created_at
  FROM orders o
  WHERE o.sender_contact_id IS NULL
    AND COALESCE(trim(o.sender->>'email'), '') <> ''
    AND COALESCE(trim(o.sender->>'name'), '') <> ''
) s
ORDER BY user_id, email, created_at DESC
ON CONFLICT (user_id, email) DO UPDATE
  SET name = COALESCE(EXCLUDED.name, contacts.name),
      phone = COALESCE(EXCLUDED.phone, contacts.phone),
      street = COALESCE(EXCLUDED.street, contacts.street),
      city = COALESCE(EXCLUDED.city, contacts.city),
      state = COALESCE(EXCLUDED.state, contacts.state),
      postal_code = COALESCE(EXCLUDED.postal_code, contacts.postal_code),
      country = COALESCE(EXCLUDED.country, contacts.country),
      lat = COALESCE(EXCLUDED.lat, contacts.lat),
      lon = COALESCE(EXCLUDED.lon, contacts.lon),
      updated_at = now();

UPDATE orders o
SET sender_contact_id = c.id
FROM contacts c
WHERE o.sender_contact_id IS NULL
  AND o.user_id = c.user_id
  AND lower(trim(o.sender->>'email')) = lower(c.email::text);

-- Pass 2: receiver contacts (deduped per user_id+email)
INSERT INTO contacts (user_id, name, email, phone, street, city, state, postal_code, country, lat, lon)
SELECT DISTINCT ON (user_id, email) user_id, name, email, phone, street, city, state, postal_code, country, lat, lon
FROM (
  SELECT
    o.user_id,
    NULLIF(trim(o.receiver->>'name'), '') AS name,
    lower(trim(o.receiver->>'email'))::citext AS email,
    NULLIF(trim(o.receiver->>'phone'), '') AS phone,
    NULLIF(trim(o.receiver->'address'->>'street'), '') AS street,
    NULLIF(trim(o.receiver->'address'->>'city'), '') AS city,
    NULLIF(trim(o.receiver->'address'->>'state'), '') AS state,
    NULLIF(trim(o.receiver->'address'->>'zipCode'), '') AS postal_code,
    COALESCE(NULLIF(trim(o.receiver->'address'->>'country'), ''), 'United Kingdom') AS country,
    NULLIF(o.receiver->'address'->>'lat','')::double precision AS lat,
    NULLIF(o.receiver->'address'->>'lon','')::double precision AS lon,
    o.created_at
  FROM orders o
  WHERE o.receiver_contact_id IS NULL
    AND COALESCE(trim(o.receiver->>'email'), '') <> ''
    AND COALESCE(trim(o.receiver->>'name'), '') <> ''
) r
ORDER BY user_id, email, created_at DESC
ON CONFLICT (user_id, email) DO UPDATE
  SET name = COALESCE(EXCLUDED.name, contacts.name),
      phone = COALESCE(EXCLUDED.phone, contacts.phone),
      street = COALESCE(EXCLUDED.street, contacts.street),
      city = COALESCE(EXCLUDED.city, contacts.city),
      state = COALESCE(EXCLUDED.state, contacts.state),
      postal_code = COALESCE(EXCLUDED.postal_code, contacts.postal_code),
      country = COALESCE(EXCLUDED.country, contacts.country),
      lat = COALESCE(EXCLUDED.lat, contacts.lat),
      lon = COALESCE(EXCLUDED.lon, contacts.lon),
      updated_at = now();

UPDATE orders o
SET receiver_contact_id = c.id
FROM contacts c
WHERE o.receiver_contact_id IS NULL
  AND o.user_id = c.user_id
  AND lower(trim(o.receiver->>'email')) = lower(c.email::text);