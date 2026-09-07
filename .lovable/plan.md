# Project management hub, recurring tasks, and tidier task visibility

## 1. Show "My tasks" in one place only

Today the personal task list appears on the home page, the dashboard, the loading page, the inspections page and the mechanic clock page.

- Keep it only on the home page (for internal staff, as it is now).
- Remove it from: Dashboard, Loading & Storage, Bicycle Inspections, Mechanic Clock.
- Leave the task panels that belong to a specific order or a customer-service conversation untouched — those are per-job notes, not a personal list.
- Remove the "Tasks" menu entry and the task bell for customer accounts, and remove business customers from the Tasks page permission so a direct link sends them back to their own pages. Internal staff keep the full Tasks page.

## 2. New "Project manager" role

- Adds `project_manager` as a role that can be assigned in User Management and counts as internal staff.
- By default it unlocks only the new Project Management page plus their own profile; an admin can grant more pages later from the existing Route Permissions screen.
- Admins can always see the new page.

## 3. New Project Management page (`/project-management`)

Four tabs:

**Weekly plan**
- Mon-Sun grid for the chosen week, one column per day, with previous/next week and "this week" controls.
- Each card shows the task, who it is for, priority, service category, and whether it is done.
- Drag a task onto a day (or use a date picker on the card) to schedule it; unscheduled work sits in a side "Backlog" column.
- Filters: person, role, service category, priority, status, and free-text search.

**Pending tasks**
- Full list of everything outstanding across all staff, newest or most overdue first, with the same filters.
- Row actions: assign to someone, set a date (adds it to the weekly calendar), change priority, open the existing task detail drawer.
- Bulk select to assign or date several at once.

**Repeating tasks**
- Create a repeating task with: title, notes, service category, priority, who it is for (a named person **or** a whole role — one task per person in that role), and a schedule:
  - every working day (Mon-Fri)
  - chosen days of the week
  - every N weeks or months
  - a start date and an optional "until" date
- List of existing repeating tasks with pause/resume, edit, delete, next-run date, and a "Generate now" button.
- A daily background job creates that day's tasks automatically; it never creates the same day twice.

**Dashboard**
- Outstanding vs completed counts per service (bike boxing, foaming, inspections/servicing, builds, review collecting, transport/collections, Northern Ireland, admin/other), for the selected week or month.
- Per-person breakdown: outstanding, completed, overdue.
- Day-by-day bar chart across the week so you can see load spikes.
- Overdue and unassigned call-out cards at the top.
- Live operational counts pulled from the existing Box My Bike, Foam My Bike and inspection stages, so the picture is not limited to manually created tasks.

**Other project-management help included**
- Overdue and unassigned highlighting, workload-per-person view, and a one-click "roll unfinished tasks to tomorrow" action.

## Technical notes

Database (one migration):
- `ALTER TYPE user_role ADD VALUE 'project_manager'`; add it to `is_internal_staff`.
- `tasks`: add `category text`, `planned_date date`, `recurrence_id uuid`.
- New `task_recurrences` table: title, description, category, priority, assignee_id, assignee_role, frequency (`weekdays`/`days_of_week`/`weekly`/`monthly`), `interval_n int`, `days_of_week int[]`, `start_date`, `end_date`, `active`, `last_generated_on`, created_by, timestamps. GRANTs for `authenticated` (+`service_role`), RLS: internal staff read, admin/project_manager write.
- Seed `role_route_permissions` rows for the new `project-management` route key (project_manager, admin implicit) and `profile`; delete any `b2b_customer` row for the `tasks` key.

Code:
- `src/config/routes.ts`: new `project-management` route (section Operations), add `project_manager` to `ASSIGNABLE_PERMISSION_ROLES`; `src/types/user.ts` + `src/lib/roles.ts` add the role label.
- Remove `MyTasksPanel`/`MyTasksWidget` usages from `Dashboard.tsx`, `LoadingUnloadingPage.tsx`, `BicycleInspections.tsx`, `MechanicClock.tsx`.
- New `src/pages/ProjectManagement.tsx` with tab components under `src/components/project/` (`WeeklyPlanBoard`, `PendingTasksTable`, `RecurringTasksTab`, `PmDashboard`), reusing `useTasks`, `TaskDetailDrawer`, `TaskDialog`.
- `src/services/tasksService.ts`: add category/planned_date filters and recurrence CRUD (or a new `recurringTasksService.ts`).
- New edge function `generate-recurring-tasks` (service role, cron-secret guarded) scheduled daily via pg_cron; also callable from the "Generate now" button.
