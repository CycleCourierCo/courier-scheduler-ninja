
# To-Do / Tasks System

A lightweight task management feature for internal staff. Tasks can optionally be linked to an order and/or a customer-service conversation, and assigned to any internal user.

## 1. Data model (new tables)

**`tasks`**
- `title` (text, required), `description` (text)
- `status`: `open` | `in_progress` | `blocked` | `done` | `cancelled` (default `open`)
- `priority`: `low` | `normal` | `high` | `urgent` (default `normal`)
- `due_date` (timestamptz, nullable)
- `assignee_id` (uuid → profiles, nullable)
- `created_by` (uuid → profiles)
- `linked_order_id` (uuid → orders, nullable)
- `linked_conversation_id` (uuid → cs_conversations, nullable)
- `completed_at` (timestamptz, nullable)
- standard `id / created_at / updated_at`

**`task_comments`** — `task_id`, `author_id`, `body`, timestamps (for activity log; minimal v1).

Indexes on `assignee_id`, `status`, `linked_order_id`, `linked_conversation_id`, `due_date`.

### Access (RLS)
- New SECURITY DEFINER helper `is_internal_staff(uid)` returning true for: `admin`, `cs_agent`, `route_planner`, `loader`, `driver`, `sales`, `timeslip_admin`, `mechanic` (excludes `b2b_customer` / `b2c_customer`).
- All `tasks` / `task_comments` actions allowed only to internal staff; customers see nothing.
- Standard GRANTs to `authenticated` + `service_role`.

## 2. Service + hooks
- `src/services/tasksService.ts` — `listTasks(filters)`, `getTask`, `createTask`, `updateTask`, `deleteTask`, `addTaskComment`, `listTasksForOrder`, `listTasksForConversation`, `listMyTasks`.
- `src/hooks/useTasks.ts` — react-query wrappers with realtime invalidation on `tasks`.
- Zod schemas for client + edge validation.

## 3. UI surfaces

### a. Dedicated `/tasks` page (new)
- Filters: status, priority, assignee (Mine / Unassigned / Anyone), due (overdue / today / week), linked order search, free-text.
- Default view: table; toggle to Kanban by status.
- "New task" dialog: title, description, assignee (internal users dropdown), due date, priority, optional order picker, optional conversation picker.
- Row click → task detail drawer with edit fields + comments thread.
- Added to `Layout` nav for internal roles; `ProtectedRoute` updated.

### b. My Tasks widget on Dashboard
- Compact card listing open tasks assigned to current user, sorted by due date, with overdue badge. Click → `/tasks/:id`.

### c. Order Detail — "Tasks" tab
- Lists tasks where `linked_order_id = order.id`.
- "Add task" button pre-fills the order link.

### d. Inbox ContextPanel — Tasks section
- Shows tasks linked to the current conversation (and any linked order).
- "Create task" button opens the same dialog, pre-filled with `linked_conversation_id`, `linked_order_id` (if conversation has one), and a suggested title derived from subject / last inbound message preview. Description auto-seeds from the latest inbound message body, editable.
- After save: toast + task appears in the panel; conversation gets an internal note "Task created: {title}" for audit.

## 4. Realtime
- Enable Supabase realtime on `tasks` so list/detail/widgets refresh live across sessions.

## 5. Permissions summary
- Create/edit/assign/complete: all internal staff.
- Delete: admin only.
- Customers: no access (table hidden by RLS, no nav entry, route guarded).

## 6. Out of scope (v1)
- Email/WhatsApp notifications on assignment (can add later via existing send-email function).
- Subtasks, checklists, recurring tasks, file attachments.
- SLA timers.

## Technical notes
- Conversation/order pickers reuse existing `searchOrdersForLink` and a new lightweight conversation search (subject + contact handle).
- Internal-user dropdown loads from `profiles` joined with `user_roles` filtered by internal roles (server-side via SECURITY DEFINER function to avoid leaking the full profiles list).
- Following project memory: `EdgeRuntime.waitUntil` not needed (no edge functions in v1); all logic is client + RLS-protected DB writes.
