# Repeating tasks appear on their own, plus a workshop queue for mechanics

## 1. Repeating tasks land on the calendar automatically

Today the nightly job only ever creates tasks for the current day, so the week ahead looks empty and a newly set up repeat shows nothing until the next morning. That is why the "Generate today's tasks" button feels necessary.

Changes:
- Each repeating task gets a new setting: **"Create how far ahead?"** in days (default 14, allowed 1–60). This answers "how long for" per repeat, so a daily chore can be filled in for a fortnight while a monthly one can be set further out.
- The nightly job (6am, UK time) creates every occurrence from today up to that horizon, skipping anything already created, so tasks show on the right day and person in advance.
- Saving a new or edited repeat immediately fills in its upcoming occurrences, so it appears on the calendar the moment it is set up — no button press.
- The manual "Generate today's tasks" button stays as a harmless catch-up, relabelled "Fill in repeating tasks now".

## 2. Workshop queue tab on Project Management

A new **Workshop queue** tab beside Weekly plan, Pending tasks, Repeating tasks and Dashboard, with two lists:

- **Bikes to inspect** — bikes collected and not yet inspected, newest collection first, with a "Collected yesterday" marker on the fresh ones and a day-count on older ones so nothing is forgotten.
- **Repairs ready to start** — bikes whose approved repairs have their parts in (arrived or in stock), with the repair time added up.

Each row shows the bike, tracking number, how long it has been waiting, the expected minutes of work, and links through to the order or inspection.

Each row has **Add to calendar**: a small dialog to choose the mechanic and the day. That creates a normal task on the weekly plan (title such as "Inspect Trek Domane - CCC…", service category workshop, length taken from the estimated minutes) so it fills a slot on the timed week grid like any other task. Rows already added show as "On the plan" with a link to the task, so the same bike is not added twice.

## Technical notes

- Migration: `task_recurrences.horizon_days integer not null default 14`; `tasks.order_id` / `tasks.inspection_id` already exist for linking (verified), so a task created from the queue is matched back by those columns plus a `source` marker of `workshop_queue`.
- `supabase/functions/generate-recurring-tasks/index.ts`: loop dates from today through `today + horizon_days` (capped 60), reuse the existing `matches()` rules and the existing duplicate check on `recurrence_id` + `planned_date` + assignee, keep `estimated_minutes`. Response reports created count per date range.
- `src/services/recurringTasksService.ts` + `useRecurringTasks.ts`: call the function after create and update mutations so occurrences appear immediately; `RecurringTasksTab.tsx` gains the horizon field.
- New `src/services/workshopQueueService.ts` reusing the logic in `workshopScheduleService.ts`: bikes to inspect = orders `needs_inspection` true, `order_collected` true, not cancelled/delivered, with no inspection or inspection status `pending` (`pickup_date` used as the collection day, since there is no separate collected timestamp); repairs ready = inspections with approved issues whose `parts_arrived` or `parts_in_stock` is true and no blocking missing part; minutes from `labour_times` with the hourly-rate fallback already used today.
- New `src/components/project/WorkshopQueueTab.tsx` plus an assign dialog using `useInternalUsers()` and `createTask` from `tasksService`.
- Typecheck with `npx tsgo --noEmit`, build, and deploy `generate-recurring-tasks`.
