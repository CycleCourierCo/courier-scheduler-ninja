
-- 1) Add cs_agent role
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'cs_agent';
