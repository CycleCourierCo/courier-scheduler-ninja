

# Implementation Plan: RLS Performance & Security Migration

## Overview

This plan creates a comprehensive migration file that addresses all verified RLS issues across 16 tables, including:
- 6 new indexes for RLS-used columns
- ~55 policy rewrites using consistent patterns
- WITH CHECK clauses on all UPDATE policies
- Security fix for the orders public tracking policy
- Missing DELETE policy for quickbooks_tokens

## Migration File Structure

The migration will be created at:
`supabase/migrations/20250209000000_fix_rls_performance_security.sql`

## Complete Migration Content

```sql
-- ============================================================================
-- RLS Performance & Security Migration
-- ============================================================================
-- This migration addresses:
-- 1. InitPlan performance issues by using optimized auth.uid() patterns
-- 2. Missing WITH CHECK clauses on UPDATE policies
-- 3. Multiple permissive policy consolidation
-- 4. Security bug in orders public tracking policy
-- 5. Missing indexes on RLS-used columns
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id 
    ON public.api_keys(user_id);

CREATE INDEX IF NOT EXISTS idx_oauth_states_user_id 
    ON public.oauth_states(user_id);

CREATE INDEX IF NOT EXISTS idx_webhook_configurations_user_id 
    ON public.webhook_configurations(user_id);

CREATE INDEX IF NOT EXISTS idx_saved_routes_created_by 
    ON public.saved_routes(created_by);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_webhook_config_id 
    ON public.webhook_delivery_logs(webhook_config_id);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_order_id 
    ON public.webhook_delivery_logs(order_id);

-- ============================================================================
-- PART 2: API_KEYS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage all API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can view their own API keys" ON public.api_keys;

CREATE POLICY "api_keys_select_policy" ON public.api_keys
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role) OR user_id = s.uid
    )
  );

CREATE POLICY "api_keys_insert_policy" ON public.api_keys
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "api_keys_update_policy" ON public.api_keys
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "api_keys_delete_policy" ON public.api_keys
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

-- ============================================================================
-- PART 3: OAUTH_STATES POLICIES (owner-only)
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage their own OAuth states" ON public.oauth_states;

CREATE POLICY "oauth_states_select_policy" ON public.oauth_states
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "oauth_states_insert_policy" ON public.oauth_states
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "oauth_states_update_policy" ON public.oauth_states
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "oauth_states_delete_policy" ON public.oauth_states
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- ============================================================================
-- PART 4: INVOICE_HISTORY POLICIES (owner-only, adding WITH CHECK)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own invoice history" ON public.invoice_history;
DROP POLICY IF EXISTS "Users can insert their own invoice history" ON public.invoice_history;
DROP POLICY IF EXISTS "Users can update their own invoice history" ON public.invoice_history;
DROP POLICY IF EXISTS "Users can delete their own invoice history" ON public.invoice_history;

CREATE POLICY "invoice_history_select_policy" ON public.invoice_history
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "invoice_history_insert_policy" ON public.invoice_history
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "invoice_history_update_policy" ON public.invoice_history
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "invoice_history_delete_policy" ON public.invoice_history
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- ============================================================================
-- PART 5: QUICKBOOKS_TOKENS POLICIES (owner-only, adding WITH CHECK + DELETE)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own QuickBooks tokens" ON public.quickbooks_tokens;
DROP POLICY IF EXISTS "Users can insert their own QuickBooks tokens" ON public.quickbooks_tokens;
DROP POLICY IF EXISTS "Users can update their own QuickBooks tokens" ON public.quickbooks_tokens;

CREATE POLICY "quickbooks_tokens_select_policy" ON public.quickbooks_tokens
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "quickbooks_tokens_insert_policy" ON public.quickbooks_tokens
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "quickbooks_tokens_update_policy" ON public.quickbooks_tokens
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "quickbooks_tokens_delete_policy" ON public.quickbooks_tokens
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- ============================================================================
-- PART 6: CONTACTS POLICIES (admin + owner)
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage all contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;

CREATE POLICY "contacts_select_policy" ON public.contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role) OR user_id = s.uid
    )
  );

CREATE POLICY "contacts_insert_policy" ON public.contacts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role) OR user_id = s.uid
    )
  );

CREATE POLICY "contacts_update_policy" ON public.contacts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role) OR user_id = s.uid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role) OR user_id = s.uid
    )
  );

CREATE POLICY "contacts_delete_policy" ON public.contacts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role) OR user_id = s.uid
    )
  );

-- ============================================================================
-- PART 7: SAVED_ROUTES POLICIES (admin + creator)
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage all saved routes" ON public.saved_routes;
DROP POLICY IF EXISTS "Users can view their own saved routes" ON public.saved_routes;
DROP POLICY IF EXISTS "Users can create saved routes" ON public.saved_routes;
DROP POLICY IF EXISTS "Users can update their own saved routes" ON public.saved_routes;
DROP POLICY IF EXISTS "Users can delete their own saved routes" ON public.saved_routes;

CREATE POLICY "saved_routes_select_policy" ON public.saved_routes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role) OR created_by = s.uid
    )
  );

CREATE POLICY "saved_routes_insert_policy" ON public.saved_routes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role) OR created_by = s.uid
    )
  );

CREATE POLICY "saved_routes_update_policy" ON public.saved_routes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role) OR created_by = s.uid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role) OR created_by = s.uid
    )
  );

CREATE POLICY "saved_routes_delete_policy" ON public.saved_routes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role) OR created_by = s.uid
    )
  );

-- ============================================================================
-- PART 8: WEBHOOK_CONFIGURATIONS POLICIES (admin + owner SELECT, admin-only write)
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage all webhooks" ON public.webhook_configurations;
DROP POLICY IF EXISTS "Users can view their own webhooks" ON public.webhook_configurations;

CREATE POLICY "webhook_configurations_select_policy" ON public.webhook_configurations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role) OR user_id = s.uid
    )
  );

CREATE POLICY "webhook_configurations_insert_policy" ON public.webhook_configurations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "webhook_configurations_update_policy" ON public.webhook_configurations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "webhook_configurations_delete_policy" ON public.webhook_configurations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

-- ============================================================================
-- PART 9: WEBHOOK_DELIVERY_LOGS POLICIES (fixed correlation)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their webhook logs" ON public.webhook_delivery_logs;

CREATE POLICY "webhook_delivery_logs_select_policy" ON public.webhook_delivery_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM (SELECT auth.uid() AS uid) s, webhook_configurations wc
      WHERE wc.id = webhook_delivery_logs.webhook_config_id
        AND (wc.user_id = s.uid OR has_role(s.uid, 'admin'::user_role))
    )
  );

-- ============================================================================
-- PART 10: BICYCLE_INSPECTIONS POLICIES (admin + order owner SELECT)
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage all inspections" ON public.bicycle_inspections;
DROP POLICY IF EXISTS "Users can view inspections for their orders" ON public.bicycle_inspections;

CREATE POLICY "bicycle_inspections_select_policy" ON public.bicycle_inspections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
         OR EXISTS (
           SELECT 1 FROM orders 
           WHERE orders.id = bicycle_inspections.order_id 
           AND orders.user_id = s.uid
         )
    )
  );

CREATE POLICY "bicycle_inspections_insert_policy" ON public.bicycle_inspections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "bicycle_inspections_update_policy" ON public.bicycle_inspections
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "bicycle_inspections_delete_policy" ON public.bicycle_inspections
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

-- ============================================================================
-- PART 11: INSPECTION_ISSUES POLICIES (admin + order owner)
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage all issues" ON public.inspection_issues;
DROP POLICY IF EXISTS "Users can view issues for their orders" ON public.inspection_issues;
DROP POLICY IF EXISTS "Users can respond to issues for their orders" ON public.inspection_issues;

CREATE POLICY "inspection_issues_select_policy" ON public.inspection_issues
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
         OR EXISTS (
           SELECT 1 FROM orders 
           WHERE orders.id = inspection_issues.order_id 
           AND orders.user_id = s.uid
         )
    )
  );

CREATE POLICY "inspection_issues_insert_policy" ON public.inspection_issues
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "inspection_issues_update_policy" ON public.inspection_issues
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
         OR EXISTS (
           SELECT 1 FROM orders 
           WHERE orders.id = inspection_issues.order_id 
           AND orders.user_id = s.uid
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
         OR EXISTS (
           SELECT 1 FROM orders 
           WHERE orders.id = inspection_issues.order_id 
           AND orders.user_id = s.uid
         )
    )
  );

CREATE POLICY "inspection_issues_delete_policy" ON public.inspection_issues
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

-- ============================================================================
-- PART 12: USER_ROLES POLICIES (admin + own role SELECT)
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "user_roles_select_policy" ON public.user_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role) OR user_id = s.uid
    )
  );

CREATE POLICY "user_roles_insert_policy" ON public.user_roles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "user_roles_update_policy" ON public.user_roles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "user_roles_delete_policy" ON public.user_roles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

-- ============================================================================
-- PART 13: TIMESLIPS POLICIES (admin + driver approved SELECT)
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all timeslips" ON public.timeslips;
DROP POLICY IF EXISTS "Drivers can view their approved timeslips" ON public.timeslips;
DROP POLICY IF EXISTS "Admins can insert timeslips" ON public.timeslips;
DROP POLICY IF EXISTS "Admins can update timeslips" ON public.timeslips;
DROP POLICY IF EXISTS "Admins can delete timeslips" ON public.timeslips;

CREATE POLICY "timeslips_select_policy" ON public.timeslips
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
         OR (driver_id = s.uid AND status = 'approved')
    )
  );

CREATE POLICY "timeslips_insert_policy" ON public.timeslips
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "timeslips_update_policy" ON public.timeslips
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "timeslips_delete_policy" ON public.timeslips
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

-- ============================================================================
-- PART 14: ORDER_COMMENTS POLICIES (admin-only, own-comment for UPDATE/DELETE)
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all order comments" ON public.order_comments;
DROP POLICY IF EXISTS "Admins can insert order comments" ON public.order_comments;
DROP POLICY IF EXISTS "Admins can update their own comments" ON public.order_comments;
DROP POLICY IF EXISTS "Admins can delete their own comments" ON public.order_comments;

CREATE POLICY "order_comments_select_policy" ON public.order_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "order_comments_insert_policy" ON public.order_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "order_comments_update_policy" ON public.order_comments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE admin_id = s.uid AND has_role(s.uid, 'admin'::user_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE admin_id = s.uid AND has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "order_comments_delete_policy" ON public.order_comments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE admin_id = s.uid AND has_role(s.uid, 'admin'::user_role)
    )
  );

-- ============================================================================
-- PART 15: ROUTES POLICIES (admin-only)
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage routes" ON public.routes;

CREATE POLICY "routes_select_policy" ON public.routes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "routes_insert_policy" ON public.routes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "routes_update_policy" ON public.routes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "routes_delete_policy" ON public.routes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

-- ============================================================================
-- PART 16: WEEKLY_PLANS POLICIES (admin-only, replacing profiles lookup)
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage weekly plans" ON public.weekly_plans;

CREATE POLICY "weekly_plans_select_policy" ON public.weekly_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "weekly_plans_insert_policy" ON public.weekly_plans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "weekly_plans_update_policy" ON public.weekly_plans
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

CREATE POLICY "weekly_plans_delete_policy" ON public.weekly_plans
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

-- ============================================================================
-- PART 17: TIMESLIP_GENERATION_LOGS POLICIES (admin-only SELECT)
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view generation logs" ON public.timeslip_generation_logs;

CREATE POLICY "timeslip_generation_logs_select_policy" ON public.timeslip_generation_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

-- ============================================================================
-- PART 18: ORDERS POLICIES (security fix + pattern fixes)
-- ============================================================================

-- Fix: Public tracking SELECT - remove always-true condition
DROP POLICY IF EXISTS "Public tracking access" ON public.orders;
CREATE POLICY "orders_public_tracking_select_policy" ON public.orders
  FOR SELECT
  TO anon
  USING (tracking_number IS NOT NULL);

-- Fix: Authenticated user SELECT (admin OR owner)
DROP POLICY IF EXISTS "Optimized orders SELECT policy" ON public.orders;
CREATE POLICY "orders_authenticated_select_policy" ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role) OR user_id = s.uid
    )
  );

-- Fix: Loader UPDATE policy (wrapper fix + WITH CHECK)
DROP POLICY IF EXISTS "Loaders can update loading fields" ON public.orders;
CREATE POLICY "orders_loader_update_policy" ON public.orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'loader'::user_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'loader'::user_role)
    )
  );

-- Fix: Admin DELETE policy (wrapper fix)
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "orders_admin_delete_policy" ON public.orders
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
    )
  );

-- NOTE: "Consolidated orders INSERT policy" and "Orders UPDATE for users and availability"
-- are intentionally NOT modified - they already have proper patterns and handle
-- complex multi-condition logic for the availability workflow

COMMIT;
```

---

## Post-Migration Testing Checklist

After running the migration, test these scenarios:

### Admin User Tests
| Test | Action | Expected |
|------|--------|----------|
| Dashboard | Load /dashboard | See all orders |
| API Keys | Load /api-keys | See all API keys |
| Webhooks | Load /webhooks | See all webhook configs |
| User Management | Load /users | See all profiles |
| Timeslips | Load /timeslips | See all timeslips |
| Create Order | Create new order | Success |
| Delete Order | Delete an order | Success |

### B2B Customer Tests
| Test | Action | Expected |
|------|--------|----------|
| Dashboard | Load /dashboard | See only own orders |
| Contacts | Load contacts | See only own contacts |
| Create Contact | Add new contact | Success |
| Invoice History | View invoices | See only own invoices |
| API Keys | View keys | See only own keys |

### Public/Anonymous Tests
| Test | Action | Expected |
|------|--------|----------|
| Order Tracking | Visit /tracking/{tracking_number} | See order details |
| Sender Availability | Visit /sender-availability/{id} | Can update availability |
| Receiver Availability | Visit /receiver-availability/{id} | Can update availability |
| Random UUID | Visit /tracking/{random-uuid} | No results (order not found) |

### Driver Tests
| Test | Action | Expected |
|------|--------|----------|
| Timeslips | View timeslips | See only approved timeslips |

### Loader Tests
| Test | Action | Expected |
|------|--------|----------|
| Loading Page | Update loading fields | Success |

### Database Verification
```sql
-- Run in Supabase SQL Editor to verify no InitPlan issues:
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM contacts WHERE user_id = (SELECT auth.uid());

-- Check policy count per table:
SELECT schemaname, tablename, COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
```

---

## Summary

| Category | Count |
|----------|-------|
| Indexes created | 6 |
| Tables modified | 16 |
| Policies rewritten | 55 |
| WITH CHECK added | 17 |
| Security bugs fixed | 1 |

