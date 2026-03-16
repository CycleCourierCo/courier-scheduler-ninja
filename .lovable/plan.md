

## Announcement Emails Page

### What It Does
A new admin-only page at `/emails` where you can compose and send announcement emails to customers. You can target recipients by:
- **Individual selection** — search and pick specific customers from the profiles table
- **Role-based selection** — select all users of a given role (e.g. all B2B customers, all drivers)

The page includes a subject line, rich text body (HTML), and a send button. It uses the existing `send-email` edge function which already supports custom subject/html/text emails via Resend.

### Changes

**New file: `src/pages/AnnouncementEmailsPage.tsx`**
- Admin-only page wrapped in `Layout`
- Two recipient modes: "Individual" (multi-select from profiles) and "By Role" (checkboxes for each role)
- Fetches profiles from Supabase to populate customer list (name + email)
- Form fields: subject, HTML body (textarea), preview toggle
- On send: calls `send-email` edge function for each recipient with the composed email
- Shows progress and success/error feedback
- Uses existing UI components (Card, Input, Textarea, Button, Checkbox, Badge, Select)

**Modified: `src/App.tsx`**
- Add route `/emails` with `ProtectedRoute adminOnly={true}`

**Modified: `src/components/Layout.tsx`**
- Add "Emails" link with Mail icon in admin navigation sections (mobile sheet + desktop dropdown)

### Technical Notes
- The existing `send-email` function's generic branch (line 311-316) already handles custom subject/html/text — no edge function changes needed
- Emails sent sequentially with a small delay to avoid rate limits, with a progress indicator
- Recipients are deduplicated by email address before sending
- The page fetches all profiles with `account_status = 'approved'` for the individual picker

### Files
- **Create**: `src/pages/AnnouncementEmailsPage.tsx`
- **Modify**: `src/App.tsx` (add route)
- **Modify**: `src/components/Layout.tsx` (add nav link)

