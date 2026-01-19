-- Create unique index for ON CONFLICT to work
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_user_email 
ON public.contacts (user_id, email) 
WHERE email IS NOT NULL;