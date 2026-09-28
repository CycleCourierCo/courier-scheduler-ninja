# Hide suspended drivers everywhere

## Why they still show

The new filters only check the "active" switch on each account. Of your 15 suspended drivers, 7 still have that switch on, so they slip through. Right now there are 13 approved drivers, 8 that are suspended and inactive, and 7 that are suspended but still marked active.

## Change

- Treat an account as inactive when **either** the active switch is off **or** its status is suspended or rejected.
- This applies to every list touched in the last change:
  - Rota and holiday approvals
  - Log absence and allowance
  - Timeslip and loading lists
  - Task, inbox, equipment and review pickers
  - Mechanic allocation
- The Show inactive switch on timeslips also brings suspended drivers back into view.
- Suspended drivers can't request holidays. When an account is suspended, its pending requests are cancelled, the same as when it's deactivated.
- No existing data is changed. The 7 suspended drivers keep their active switch as it is; they are simply hidden.

## Technical details

- **Shared check:** one frontend helper, `isActiveAccount(p) = p.is_active !== false && !['suspended','rejected'].includes(p.account_status)`, used by:
  - `activeUsersService`
  - `listUsersByRole`
  - `listInternalUsers`, `fetchStaffOptions`, equipment and review lists
  - `UnallocatedBoxFoamCard`
- **Direct queries:** in `CreateTimeslipDialog`, `BulkAssignVehicleDialog` and `LoadingUnloadingPage`, select `account_status` and filter with the helper after loading, replacing the `.or(...)` filter.
- **Staff list function:** `list_internal_users()` returns `is_active` as false when the account is suspended or rejected.
- **Absence guard:** the trigger's check that a driver is active also rejects suspended and rejected accounts.
- **Cancelling pending requests:** the profile trigger now also fires on `account_status` and cancels pending requests when the account becomes suspended or rejected.
