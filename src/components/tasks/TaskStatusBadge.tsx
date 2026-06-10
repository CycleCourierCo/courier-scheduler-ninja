import React from "react";
import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@/types/task";

const map: Record<TaskStatus, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200' },
  in_progress: { label: 'In progress', cls: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200' },
  blocked: { label: 'Blocked', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' },
  done: { label: 'Done', cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-muted text-muted-foreground' },
};

const TaskStatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => {
  const m = map[status];
  return <Badge variant="outline" className={`text-[10px] ${m.cls}`}>{m.label}</Badge>;
};

export default TaskStatusBadge;
