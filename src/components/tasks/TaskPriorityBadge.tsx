import React from "react";
import { Badge } from "@/components/ui/badge";
import type { TaskPriority } from "@/types/task";

const map: Record<TaskPriority, { label: string; cls: string }> = {
  low: { label: 'Low', cls: 'bg-muted text-muted-foreground' },
  normal: { label: 'Normal', cls: 'bg-secondary text-secondary-foreground' },
  high: { label: 'High', cls: 'bg-status-waiting/10 text-status-waiting dark:bg-status-waiting/20 dark:text-status-waiting' },
  urgent: { label: 'Urgent', cls: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200' },
};

const TaskPriorityBadge: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
  const m = map[priority];
  return <Badge variant="outline" className={`text-[10px] ${m.cls}`}>{m.label}</Badge>;
};

export default TaskPriorityBadge;
