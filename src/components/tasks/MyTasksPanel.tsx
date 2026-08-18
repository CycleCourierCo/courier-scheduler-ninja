import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { CheckSquare, ExternalLink, Package, AlertTriangle } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/contexts/AuthContext";
import TaskStatusBadge from "./TaskStatusBadge";
import TaskDetailDrawer from "./TaskDetailDrawer";
import type { Task, TaskPriority } from "@/types/task";

type PanelFilter = "active" | "overdue" | "done";

const priorityVariant: Record<TaskPriority, "secondary" | "outline" | "warning" | "destructive"> = {
  low: "outline",
  normal: "secondary",
  high: "warning",
  urgent: "destructive",
};

const isOverdue = (t: Task) =>
  !!t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));

interface MyTasksPanelProps {
  title?: string;
  className?: string;
  limit?: number;
}

const MyTasksPanel: React.FC<MyTasksPanelProps> = ({ title = "My tasks", className, limit }) => {
  const { user } = useAuth();
  const [filter, setFilter] = useState<PanelFilter>("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: activeTasks = [], isLoading: loadingActive } = useTasks({
    assignee: "mine",
    userId: user?.id,
    status: "active",
  });
  const { data: doneTasks = [], isLoading: loadingDone } = useTasks({
    assignee: "mine",
    userId: user?.id,
    status: "done",
  });

  const overdueCount = useMemo(() => activeTasks.filter(isOverdue).length, [activeTasks]);

  const visible = useMemo(() => {
    const base =
      filter === "done" ? doneTasks : filter === "overdue" ? activeTasks.filter(isOverdue) : activeTasks;
    const sorted = [...base].sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return b.created_at.localeCompare(a.created_at);
    });
    return limit ? sorted.slice(0, limit) : sorted;
  }, [filter, activeTasks, doneTasks, limit]);

  const loading = filter === "done" ? loadingDone : loadingActive;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" /> {title}
          {activeTasks.length > 0 && (
            <Badge variant="secondary">{activeTasks.length}</Badge>
          )}
          {overdueCount > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {overdueCount} overdue
            </Badge>
          )}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {(["active", "overdue", "done"] as PanelFilter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              className="h-7 px-2 text-xs capitalize"
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
          <Link to="/tasks" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            Open full task list <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <div className="text-xs text-muted-foreground">Loading tasks…</div>}
        {!loading && visible.length === 0 && (
          <div className="text-xs text-muted-foreground">
            {filter === "done" ? "No completed tasks yet." : "No tasks assigned to you right now."}
          </div>
        )}
        {visible.map((t) => (
          <div
            key={t.id}
            className="w-full border rounded p-2 hover:bg-accent/60 transition-colors"
          >
            <button
              onClick={() => setSelectedId(t.id)}
              className="w-full text-left flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
            >
              <span className="text-sm font-medium break-words flex-1">{t.title}</span>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Badge variant={priorityVariant[t.priority]} className="text-[10px] capitalize">
                  {t.priority}
                </Badge>
                {t.due_date && (
                  <span
                    className={`text-[11px] ${isOverdue(t) ? "text-destructive font-medium" : "text-muted-foreground"}`}
                  >
                    {format(new Date(t.due_date), "d MMM")}
                  </span>
                )}
                <TaskStatusBadge status={t.status} />
              </div>
            </button>
            {t.linked_order_id && (
              <Link
                to={`/orders/${t.linked_order_id}`}
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <Package className="h-3 w-3" /> View linked job
              </Link>
            )}
          </div>
        ))}
      </CardContent>
      <TaskDetailDrawer taskId={selectedId} onOpenChange={(o) => !o && setSelectedId(null)} />
    </Card>
  );
};

export default MyTasksPanel;
