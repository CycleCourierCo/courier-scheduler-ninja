## Add Delete Order button to Order Detail page

Add a destructive "Delete Order" button at the bottom of `src/pages/OrderDetail.tsx`, admin-only, that permanently deletes the order from the portal and removes its Shipday jobs. Unlike the existing "Cancel Order" button, it does **not** send cancellation emails.

### Behaviour
1. Button is rendered in a new section at the bottom of the page (after `OrderComments`), inside a bordered destructive-styled card titled "Danger Zone".
2. Visible only to admins (`useAuth().isAdmin` / role check already used elsewhere in this file).
3. Clicking opens an `AlertDialog` confirming: "This will permanently delete the order and its Shipday jobs. Cancellation emails will NOT be sent. This action cannot be undone." with Cancel / Delete buttons.
4. On confirm:
   - Call `deleteShipdayJobs(orderId)` (existing helper in `src/services/shipdayService.ts`) — wrapped in try/catch so a Shipday failure surfaces a warning toast but does not block deletion.
   - Delete the order row via `supabase.from('orders').delete().eq('id', orderId)`. RLS already allows admin delete.
   - On success: toast success, navigate back to `/dashboard` (or `-1` via `useNavigate`).
   - On failure: toast error, keep user on page.
5. Button shows a loading spinner state while deletion is in progress; disabled during request.
6. No email send is invoked (explicitly different from the Cancel flow at line ~1009).

### Files
- **Edit** `src/pages/OrderDetail.tsx`
  - Import `AlertDialog*` from `@/components/ui/alert-dialog` and `Trash2` icon.
  - Add local state `deleting`.
  - Add `handleDeleteOrder` function.
  - Render Danger Zone card with delete button at the bottom of the page, gated on admin.

### Out of scope
- No DB schema or RLS changes (admin delete policy already exists on `orders`).
- No edge function changes; reuses existing `delete-shipday-order` function via `deleteShipdayJobs`.
- No changes to the existing Cancel Order flow or email service.
- No bulk delete, no audit log entry (can add later if requested).
