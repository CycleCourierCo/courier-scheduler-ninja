# My Tasks for Loaders and Mechanics

## Where tasks show today

- **/tasks page** — full task list with filters (status, priority, assignee, due, search). The link lives in the account dropdown / mobile menu and is visible to every signed-in user, including loaders and mechanics.
- **Dashboard** — the "My tasks" widget (up to 8 active tasks assigned to you).
- **Order pages** — Box My Bike and Foam My Bike show an "Assigned: {name}" badge plus an Assign button per job; orders and conversations have their own task panels.

Loaders and mechanics whose only role is loader/mechanic get a stripped-down nav, so in practice they never land on the Dashboard widget and have to hunt through the profile dropdown for /tasks. Nothing in their day-to-day pages tells them a task was assigned to them. Database permissions already allow both roles to read and update tasks, so this is purely a surfacing problem.

## What to build

A single reusable "My tasks" panel, surfaced on the home page for every signed-in staff member plus in the places each role already works:

1. **Shared panel component** — shows the signed-in user's tasks with a small status toggle (Active / Overdue / Done), due-date and priority indicators, a link through to the linked order or Box/Foam job where one exists, and click-to-open of the existing task detail drawer (so they can comment, change status, and complete from there). An "Open full task list" link to /tasks.
2. **Home page** — when a signed-in staff member (loader, mechanic, driver, admin, etc.) lands on `/`, show the "My tasks" panel high up, directly under the hero, with a count of active and overdue tasks. Signed-out visitors and customer accounts see the marketing page exactly as it is today. This means loaders and mechanics see their assignments immediately on login without needing the Dashboard.
3. **Loaders** — new "My Tasks" tab on the Loading & Unloading page, alongside the existing tabs, with a count badge for active tasks.
4. **Mechanics** — new "My Tasks" tab on the Bicycle Inspections page (same count badge), plus the panel on the Clock In/Out page so it is visible when starting a shift.
5. **Navigation** — add a direct "My Tasks" link to the loader and mechanic nav sections in the header (currently it is only buried in the profile dropdown).

## Technical notes

- New component `src/components/tasks/MyTasksPanel.tsx`, built on the existing `useTasks({ assignee: 'mine', userId, status })` hook and `TaskDetailDrawer`; `MyTasksWidget` stays as-is for the Dashboard.
- Home page: render the panel in `src/pages/Index.tsx`, gated on an authenticated internal-staff role so the public landing page is unchanged for visitors and customers.
- Loading page: add a tab in `src/pages/LoadingUnloadingPage.tsx`. Inspections: add a tab in `src/pages/BicycleInspections.tsx`. Clock page: render the panel in `src/pages/MechanicClock.tsx`.
- Nav links added to the `loader`/`mechanic` branches in `src/components/Layout.tsx` (desktop nav and mobile sheet).
- No database or RLS changes needed — `tasks` and `task_comments` already allow internal staff (which includes loader and mechanic) to select, insert and update.

