# Driver tab hidden when driver is a secondary role

## Root cause
`EditUserDialog` gates the Driver tab on `user.role === 'driver'` (single primary role from `profiles.role`). Users with multiple roles in `user_roles` (e.g. loader + driver) have their primary `role` set to something else, so the check fails and the Driver tab never renders. `UserManagement` already loads the full roles set into `rolesByUser` but doesn't pass it to the dialog.

## Fix

**`src/components/user-management/EditUserDialog.tsx`**
- Add optional `roles?: UserRole[]` prop.
- Compute `isDriver` as `(roles?.includes('driver')) || user.role === 'driver'` so it works whether the parent supplies multi-roles or not.

**`src/pages/UserManagement.tsx`**
- Pass `roles={editingUser ? getUserRoles(editingUser) : undefined}` to `<EditUserDialog />` so the multi-role set from `user_roles` drives the tab visibility.

No schema, service, or backend changes. Only the Driver tab visibility logic is affected.
