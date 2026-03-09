
## Plan: Add User Role Restrictions to Notice Bars

### Current State Analysis
Looking at the existing notice bar system, I can see:
- `notice_bars` table with fields: id, message, type, is_active, expires_at, created_by, created_at, updated_at
- `NoticeBanner` component that fetches and displays active notices
- `NoticeBarManagement` admin page for creating/managing notices
- RLS policies allow public read access for active notices, admin-only management

### Required Changes

**1. Database Schema Update**
Add a new field to the `notice_bars` table:
- `restricted_to_roles` (text[] array) - nullable field to store user roles that should see this notice
- If null/empty, notice is visible to all users (current behavior)
- If populated, only users with those roles can see the notice

**2. Frontend Component Updates**

**NoticeBanner Component (`src/components/NoticeBanner.tsx`)**
- Modify the fetch query to filter notices based on current user's role
- Add logic to check user authentication and role before displaying notices
- Handle both authenticated and anonymous users appropriately

**NoticeBarManagement Page (`src/pages/NoticeBarManagement.tsx`)**
- Add a new form field for role selection in the "Create New Notice" section
- Use multi-select component to allow selecting multiple user roles
- Display role restrictions in the notices table
- Update the creation logic to save role restrictions

**3. Database Migration**
Create migration to:
- Add `restricted_to_roles` column to `notice_bars` table
- Update RLS policies if needed (current public policy should still work)

**4. User Role Integration**
- Import and use existing user role system (`UserRole` from types)
- Leverage existing `useAuth` context to get current user role
- Handle cases for unauthenticated users (they see unrestricted notices only)

### Implementation Details

The role restriction will work as follows:
- **No roles selected**: Notice visible to everyone (existing behavior)
- **Specific roles selected**: Notice only visible to users with those roles
- **Anonymous users**: Only see notices with no role restrictions
- **Admin interface**: Dropdown with all available user roles (admin, b2b_customer, b2c_customer, driver, loader, mechanic, route_planner, sales)

### Database Changes Required
- Add `restricted_to_roles text[]` column to `notice_bars` table
- Column should be nullable to maintain backward compatibility

### Code Changes Required
1. Update `NoticeBanner.tsx` to filter by user role
2. Update `NoticeBarManagement.tsx` to include role selection UI
3. Add database migration for new column
4. Test role-based filtering works correctly

This enhancement maintains backward compatibility while adding powerful role-based targeting for announcements.
