# Task assignment notifications

Give staff an immediate signal when a task is assigned to them: a bell in the top-right of the header, plus an email.

## Notification bell

- A bell icon appears in the header (next to the account menu) for internal staff only — customers never see it.
- A red count badge shows tasks assigned to me that I haven't looked at yet (newly assigned, still active).
- Clicking the bell opens a short list (latest 10): task title, priority, due date, who assigned it, and how long ago. Clicking an entry opens the existing task detail drawer.
- Opening the bell marks everything currently listed as seen, so the badge clears; overdue/active tasks still live on the existing My Tasks panel and /tasks page.
- The list updates live — if a task is assigned while the user is on the site, the badge appears without a refresh.
- Footer link: "View all tasks" to /tasks.

## Assignment email

- When a task is created with an assignee, or an existing task is reassigned to someone new, that person gets an email.
- Content: task title, description, priority, due date, who assigned it, the linked order tracking number (when there is one), and a button through to the task.
- No email when someone assigns a task to themselves, or when the assignee is cleared.
- Sent from `CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>` with reply-to `Info@cyclecourierco.com`, matching every other email in the app.

## Technical notes

- Migration: add `task_notifications_seen_at timestamptz` to `profiles` so the seen state follows the user across devices (grants/RLS already allow self-update).
- New `src/hooks/useTaskNotifications.ts`: queries tasks where `assignee_id = auth.uid()`, status in open/in_progress/blocked, ordered by `created_at`/`updated_at`; unseen = newer than `task_notifications_seen_at`. Subscribes to `tasks` realtime (inside `useEffect`, with `removeChannel` cleanup) and reuses `tasksService`.
- New `src/components/tasks/TaskNotificationBell.tsx` (Popover + Badge), rendered in `src/components/Layout.tsx` beside the account dropdown, gated on the existing `isInternalStaff` flag; mobile sheet gets the same entry.
- New edge function `supabase/functions/send-task-assignment-email/index.ts`: validates the caller's JWT, loads the task + assignee profile + creator name + linked order tracking number with the service role client, and sends via Resend. CORS headers on every response, no PII in logs.
- `src/services/tasksService.ts`: after `createTask` and after an `updateTask` that changes `assignee_id`, fire-and-forget `supabase.functions.invoke('send-task-assignment-email', ...)`; failures surface as a toast but never block the save.
