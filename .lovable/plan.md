

## Add Scheduled Emails to Announcements Page

### What it does
Adds a "Schedule Email" button alongside "Send Email" that lets admins pick a future date/time. Scheduled emails are stored in a new `scheduled_announcements` table. A backlog section shows all scheduled emails with their status, and admins can edit or cancel pending ones.

### Changes

**1. New database table: `scheduled_announcements`**
- Columns: `id`, `subject`, `html_body`, `recipient_ids` (text[]), `recipient_roles` (text[]), `recipient_mode` (text), `scheduled_at` (timestamptz), `status` (text: pending/sent/cancelled), `created_by` (uuid), `created_at`, `sent_at`, `error_message`
- RLS: admin-only access via `has_role()`

**2. New Edge Function: `process-scheduled-announcements`**
- Called by pg_cron every minute
- Queries `scheduled_announcements` where `status = 'pending'` and `scheduled_at <= now()`
- For each, resolves recipient IDs/roles to email addresses from profiles
- Sends emails using the existing `send-email` function pattern (staggered)
- Updates status to `sent` or records error

**3. pg_cron job** (via SQL insert tool)
- Schedules `process-scheduled-announcements` to run every minute using the existing `invoke_` wrapper pattern

**4. Update `AnnouncementEmailsPage.tsx`**
- Add a "Schedule Email" button next to "Send Email" that opens a date/time picker dialog
- On confirm, inserts into `scheduled_announcements` instead of sending immediately
- Add a new "Scheduled Emails" card/section below the send buttons showing a table of all scheduled announcements:
  - Columns: Subject, Recipients count, Scheduled For, Status, Actions
  - Pending items show Edit and Cancel buttons
  - Edit opens a dialog to change subject, body, scheduled time, or recipients
  - Cancel sets status to `cancelled`
- Uses `useQuery` to fetch from `scheduled_announcements` ordered by `scheduled_at` desc

### Technical Details
- The schedule dialog uses the existing `Input type="datetime-local"` pattern (already used in NoticeBarManagement)
- Recipient resolution at send time (not schedule time) ensures any profile changes are picked up
- Store both `recipient_ids` and `recipient_roles` plus `recipient_mode` so the edge function can resolve correctly
- The edge function uses the same Resend-based `send-email` invocation pattern as the current immediate send

