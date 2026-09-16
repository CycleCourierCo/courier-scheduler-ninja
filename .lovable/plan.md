# Timed week plan, task lengths, and working task deletion

## 1. How long will it take?

Every task gets a new "How long will it take?" field (in minutes, entered as hours/minutes) on the new-task form and in the task detail panel. When it is left blank the task counts as 30 minutes.

## 2. Times down the side of the week

The Weekly plan tab becomes a timed grid:

- Times run down the left from 7:00am to 7:00pm in 30-minute rows.
- The seven days run across the top.
- Each task shows as a block whose height matches its length, stacked in order down the day from 7:00am, so a 2-hour task fills four rows.
- The day column shows how much of the day is filled (e.g. "6h 30m of 12h") and highlights when a day is overfilled past 7:00pm.
- Dragging a task onto a day still moves it to that day; dropping it onto a specific time row sets that as its start time.
- The unplanned backlog column stays where it is, on the left.

```text
        Mon 21   Tue 22   Wed 23 ...
07:00 | Fit box | Calls  |
07:30 | (1h)    |        |
08:00 |         | Invoice|
```

Tasks with no set start time simply queue from the top of the day in priority order, so nothing has to be scheduled by hand.

## 3. Deleting tasks

Deleting is currently refused for anyone who is not a full admin, and the page wrongly says "Task deleted" when nothing happened. After this change:

- Admins, project managers and the person who created the task can delete it.
- Anyone else sees a clear "You can't delete this task" message instead of a false success.
- The Delete button is hidden when the signed-in person isn't allowed to delete that task.

## Technical notes

- Migration: add `tasks.estimated_minutes integer` (nullable) and `tasks.start_time time` (nullable). Replace the `Admins can delete tasks` policy with one allowing `has_role(auth.uid(),'admin')`, `has_role(auth.uid(),'project_manager')`, or `created_by = auth.uid()`; keep the existing DELETE grant to `authenticated`.
- `deleteTask` in `src/services/tasksService.ts`: use `.delete().eq('id', id).select('id')` and throw when zero rows come back, so a policy refusal surfaces as an error rather than a success toast.
- `src/types/task.ts`: add `estimated_minutes` and `start_time` to `Task` and `CreateTaskInput`.
- `src/components/tasks/TaskDialog.tsx` and `TaskDetailDrawer.tsx`: duration input; drawer hides Delete unless admin / project_manager / creator (roles from `useAuth`/`userProfile`).
- `src/components/project/WeeklyPlanBoard.tsx`: rewrite as a time grid — 30-minute rows 07:00–19:00, absolute-positioned task blocks sized from `estimated_minutes` (default 30), auto-stacked when `start_time` is null, drop handlers set both `planned_date` and `start_time`. Keep the existing backlog column, chips, priority badges and remove-from-plan action.
- `src/components/project/RecurringTasksTab.tsx` and `generate-recurring-tasks`: carry an optional duration onto generated tasks (add `estimated_minutes` to `task_recurrences` in the same migration).
- No change to Pending tasks, Dashboard, or task assignment emails.
