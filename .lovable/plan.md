# Fix overlapping tabs in Edit User dialog

## Problem

In User Management → Edit User, the tab strip is a CSS grid locked to 2 columns on mobile (`grid w-full grid-cols-2` with `sm:grid-cols-N`). When a user has 4 tabs (Basic, Address, Driver, Pay), the extra triggers land on a second grid row that the `TabsList` has no height for, so "Driver" and "Pay" render on top of the form fields below — exactly what the screenshot shows.

## Change

- Replace the fixed grid with a layout that adapts to the number of tabs:
  - On mobile: a horizontally scrollable row of tabs (no wrapping, no overlap), with the `TabsList` sized to its content and `overflow-x-auto` so extra tabs can be swiped to.
  - On larger screens: tabs share the full width evenly as they do now.
- Let the `TabsList` grow to fit its content instead of clipping to a fixed height, so nothing bleeds into the fields underneath.
- Remove the brittle `tabCount === 5 ? ... : 4 ? ...` class-string logic; the new layout works for any number of tabs.
- Keep tab labels, ordering, and all field contents unchanged.

## Technical notes

- Single file: `src/components/user-management/EditUserDialog.tsx`.
- `TabsList` becomes `w-full justify-start gap-1 overflow-x-auto h-auto flex-nowrap` with `shrink-0` triggers on mobile, and `sm:grid sm:w-full` with a computed column count for desktop (or simply `sm:justify-between` + `sm:flex-1` triggers to avoid the count math entirely).
- No logic, schema, or service changes.
