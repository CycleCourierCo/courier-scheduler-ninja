# Show pay rate for mechanics in User Management

## Problem

In User Management → Edit User, the hourly rate field lives inside a **Driver** tab that only renders when the user has the `driver` role. A user with the `mechanic` role sees only Basic / Address, so there is nowhere to set the rate their clock-in timeslips use (`profiles.hourly_rate`, falling back to £11/hr).

## Change

- Show a pay-related tab when the user has `driver` **or** `mechanic`.
- Label it "Driver" for drivers and "Pay" for mechanic-only users.
- For a mechanic-only user, show just **Hourly Rate (£)** (no van allowance, Shipday fields, available hours, or default vehicle — those are driver-only).
- If a user has both roles, keep the existing full Driver tab as-is.

## Technical notes

- Single file: `src/components/user-management/EditUserDialog.tsx`.
- Add `isMechanic` alongside the existing `isDriver` check (roles array plus legacy `user.role`), gate the `TabsTrigger`/`TabsContent` on `isDriver || isMechanic`, and wrap the driver-only inputs in `isDriver`.
- Adjust the `TabsList` column count so tabs don't squash on mobile.
- No schema or service changes — `MechanicClock` already reads `profiles.hourly_rate`.
