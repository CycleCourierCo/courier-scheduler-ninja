-- Add 'loader' role to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'loader';

-- Note: loader users will need to be manually created or assigned this role
-- They will only have access to the loading/unloading page