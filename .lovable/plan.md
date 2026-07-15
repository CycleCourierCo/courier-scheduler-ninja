## Plan

1. **Keep CS out of User Management**
   - Leave database and edge-function permissions as admin + sales only.
   - Make sure CS-only users do not see User Management navigation/buttons.
   - Also block direct `/users` access for CS-only users via route protection.

2. **Fix admin/sales profile edit failures**
   - Add a focused migration for `profiles` update access so admin and sales can save user edits reliably.
   - Preserve the existing self-update protection that prevents normal users from changing their own role/status.
   - Keep role assignment rules unchanged: admin can assign all roles; sales can only assign customer-tier roles.

3. **Fix Jabir / mixed-role customer access**
   - Update `ProtectedRoute` so `b2b_customer` and `b2c_customer` always grant customer pages in addition to operational-role pages.
   - Include customer pages such as `/create-order`, `/dashboard`, `/customer-orders/*`, `/profile`, `/box-my-bike`, and B2B pages like `/my-stock`, `/pricing`, `/bulk-availability` where relevant.
   - Keep operational restrictions for users who are not customers.

4. **Verify**
   - Check database policies after the migration.
   - Confirm the routing logic allows a mixed-role B2B user like Jabir to reach `/create-order` while CS-only users cannot reach `/users`.