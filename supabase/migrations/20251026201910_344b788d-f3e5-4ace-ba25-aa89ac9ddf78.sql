-- Step 1: Add driver role to enum (must be in separate transaction)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'driver') THEN
    ALTER TYPE user_role ADD VALUE 'driver';
  END IF;
END $$;