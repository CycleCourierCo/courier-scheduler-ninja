# Assign Box My Bike / Foam My Bike jobs as tasks

Staff can already create tasks linked to an order elsewhere in the app. This adds the same capability directly onto Box My Bike and Foam My Bike job cards, so a specific person can be made responsible for boxing or foaming a bike.

## Change

On each Box My Bike card and each Foam My Bike (NI) card, for staff only:

- Add an **Assign** button in the card's action row.
- Clicking it opens the existing task dialog, pre-filled with:
  - Title: e.g. `Box up CCC1234567` / `Foam up CCC1234567` (falls back to the short order id when no tracking number).
  - Description: the current stage plus bike make/model and storage location, so the assignee has context.
  - Linked order: the order behind the card.
  - The assignee, priority and due date are chosen in the dialog as usual.
- If the card already has one or more open tasks, show a small badge on the card: **Assigned: {name}** (or "Assigned" when the assignee is unset), and clicking the badge opens the task detail drawer so it can be reassigned or completed.
- Once a task is done or cancelled it no longer shows on the card.

Customers viewing their own bikes see no assign controls or task badges.

## Technical notes

- Reuse `TaskDialog` (with `defaultOrderId`, `defaultTitle`, `defaultDescription`) and `TaskDetailDrawer`; no new task UI or service code.
- Fetch open tasks for the visible orders in one query (`tasks` filtered by `linked_order_id in (...)` and status `open`/`in_progress`, joined to assignee name via the existing tasks hook/service) and map them by order id for badge display.
- Files touched: `src/pages/BoxMyBikePage.tsx`, `src/components/boxmybike/FoamMyBikeSection.tsx`, plus a small shared hook (e.g. `src/hooks/useOrderTaskSummaries.ts`) for the batched open-task lookup.
- No database changes — `tasks.linked_order_id` and `assignee_id` already exist.
