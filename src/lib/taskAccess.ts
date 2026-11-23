/**
 * Task visibility. Mirrors public.can_see_all_tasks() and the tasks RLS policies:
 * admins and project managers see every task; other staff see only tasks
 * assigned to them or created by them. The database enforces this; this
 * only shapes the Tasks screen.
 */
export const TASK_OVERSIGHT_ROLES = ["admin", "project_manager"] as const;

export const canSeeAllTasks = (roles: readonly string[]): boolean =>
  roles.some((r) => (TASK_OVERSIGHT_ROLES as readonly string[]).includes(r));

export const canSeeTask = (
  roles: readonly string[],
  userId: string | null | undefined,
  task: { assignee_id: string | null; created_by: string | null },
): boolean => {
  if (canSeeAllTasks(roles)) return true;
  if (!userId) return false;
  return task.assignee_id === userId || task.created_by === userId;
};
