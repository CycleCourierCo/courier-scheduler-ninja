-- Add new role for timeslip-only admins
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'timeslip_admin';