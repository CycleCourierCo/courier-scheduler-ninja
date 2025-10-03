-- Add 'route_planner' and 'sales' roles to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'route_planner';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sales';

-- Note: These roles will have the following access:
-- route_planner: scheduling page and dashboard (all users)
-- sales: approvals, invoices, and dashboard (their own jobs only)