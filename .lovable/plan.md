

# Remove Jobs Table and Related Code

## Overview

This cleanup removes the orphaned `jobs` table and all related code from the project. The table contains 444 stale records (last activity: October 2025) and is no longer being populated or used by the current application logic. Current scheduling features derive job information directly from the `orders` table.

## Files to Delete

| File | Purpose |
|------|---------|
| `src/services/jobService.ts` | Service with job CRUD operations (never called) |
| `src/pages/JobsPage.tsx` | Admin UI for viewing jobs table data |

## Files to Modify

### 1. App Router (`src/App.tsx`)

Remove the `/jobs` route and import:

| Line | Change |
|------|--------|
| 18 | Remove `import JobsPage from "./pages/JobsPage";` |
| 67-71 | Remove the entire `/jobs` route block |

### 2. Sidebar Navigation (`src/components/ui/sidebar.tsx`)

Remove the Jobs link from the default navigation:

| Lines | Change |
|-------|--------|
| 54-58 | Remove the Jobs entry from the `links` array |

After removal, the `getDefaultLinks` function should go from Dashboard, New Order, Jobs, Scheduling... to Dashboard, New Order, Scheduling...

### 3. Shipday Webhook (`supabase/functions/shipday-webhook/index.ts`)

Remove the dead code that tries to sync with the jobs table:

| Lines | Change |
|-------|--------|
| 311-316 | Remove the `updateJobStatuses` call and try/catch block |
| 411-471 | Delete the entire `updateJobStatuses` helper function |

### 4. Supabase Types (`src/integrations/supabase/types.ts`)

The `jobs` table type definition will be automatically removed when the database migration runs (types are auto-generated from the schema).

## Database Migration

Drop the jobs table and its RLS policies:

```sql
DROP TABLE IF EXISTS public.jobs CASCADE;
```

## What Will NOT Be Changed

These files use "job" terminology but operate on `orders` data directly:

| File | Status |
|------|--------|
| `src/utils/jobUtils.ts` | Keep - derives jobs from orders |
| `src/pages/JobScheduling.tsx` | Keep - queries orders directly |
| `src/components/scheduling/*` | Keep - visualizes orders as jobs |
| `supabase/functions/query-database-completed-jobs/index.ts` | Keep - queries orders for timeslips |

These implement the current "derived approach" where collection/delivery jobs are computed from order data rather than stored separately.

## Summary of Changes

| Action | Count |
|--------|-------|
| Files to delete | 2 |
| Files to modify | 3 |
| Database tables to drop | 1 |

