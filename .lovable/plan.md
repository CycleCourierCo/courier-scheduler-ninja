

## Add Resend Availability Email Buttons to Order Detail

### What
Add "Resend Sender Availability Email" and "Resend Receiver Availability Email" buttons underneath the existing reset availability buttons on the order detail page. Visible to both admin and route_planner roles.

### Changes

**`src/pages/OrderDetail.tsx`**

1. Add a variable for admin-or-route-planner check:
   ```typescript
   const isAdminOrRoutePlanner = userProfile?.role === 'admin' || userProfile?.role === 'route_planner';
   ```

2. After the "Reset Sender Availability" button (line ~1186), add a "Resend Sender Email" button:
   - Calls `resendSenderAvailabilityEmail(id)` (already imported)
   - Uses `isResendingEmail.sender` state (already exists)
   - Gated by `isAdminOrRoutePlanner`
   - Styled as outline with mail/refresh icon

3. After the "Reset Receiver Availability" button (line ~1224), add a "Resend Receiver Email" button:
   - Calls `resendReceiverAvailabilityEmail(id)` (already imported)
   - Uses `isResendingEmail.receiver` state (already exists)
   - Gated by `isAdminOrRoutePlanner`

4. Add click handlers for both buttons using the existing `resendSenderAvailabilityEmail` and `resendReceiverAvailabilityEmail` functions from `orderService`, with loading state via `setIsResendingEmail`.

Both functions and the state management are already in the file — this is primarily a UI addition to wire existing functionality to new button placements.

