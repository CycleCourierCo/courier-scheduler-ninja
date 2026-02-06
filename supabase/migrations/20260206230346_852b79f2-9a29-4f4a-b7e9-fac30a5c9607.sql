-- Add a proper unique constraint for ON CONFLICT to work with upsert
-- This replaces the partial index behavior with a full constraint
ALTER TABLE public.contacts
ADD CONSTRAINT contacts_user_id_email_unique UNIQUE (user_id, email);