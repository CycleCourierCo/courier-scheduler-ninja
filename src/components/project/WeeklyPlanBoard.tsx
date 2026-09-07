import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, GripVertical } from "lucide-react";
import { addDays, format } from "date-fns";
import { toast } from "sonner";
import { updateTask } from "@/services/tasksService";
import { useQueryClient } from "@tanstack/react-query";
import { categoryLabel } from "@/constants/taskCategories";
import TaskPriorityBadge from "@/components/tasks/TaskPriorityBadge";
import type { Task } from "@/types/task";

interface Props {
  weekStart: Date;
  planned: Task[];
  backlog: Task[];
  onOpenTask: (id: string) => void;
  onCreateForDay: (date: string) => void;
}

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

const WeeklyPlanBoard: React.FC<Props> = ({ weekStart, planned, backlog, onOpenTask, onCreateForDay }) => {
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const move = async (taskId: string, date: string | null) => {
    try {
      await updateTask(taskId, { planned_date: date } as any);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(date ? `Moved to ${format(new Date(`${date}T00:00:00`), "EEE d MMM")}` : "Removed from the plan");
    } catch (e: any) {
      toast.error(e?.message || "Could not move that task");
    }
  };

  const TaskChip: React.FC<{ task: Task; showRemove?: boolean }> = ({ task, showRemove }) => (
    <div
      draggable
      onDragStart={() => setDragId(task.id)}
      onDragEnd={() => { setDragId(null); setOverKey(null); }}
      className={`group border rounded p-2 text-xs bg-card hover:bg-accent cursor-grab ${dragId === task.id ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-1">
        <GripVertical className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
        <button className="text-left flex-1 min-w-0" onClick={() => onOpenTask(task.id)}>
          <div className="font-medium truncate">{task.title}</div>
          <div className="text-muted-foreground truncate">
            {task.assignee?.name || task.assignee?.email || "Unassigned"} · {categoryLabel(task.category)}
          </div>
        </button>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <TaskPriorityBadge priority={task.priority} />
          {showRemove && (
            <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100"
              onClick={() => move(task.id, null)}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid gap-3 lg:grid-cols-4 min-w-0">
      <Card className="lg:col-span-1 min-w-0">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Unplanned backlog</span>
            <Badge variant="secondary">{backlog.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent
          className="space-y-2 max-h-[60vh] overflow-y-auto"
          onDragOver={(e) => { e.preventDefault(); setOverKey("backlog"); }}
          onDrop={() => { if (dragId) move(dragId, null); setDragId(null); setOverKey(null); }}
        >
          {backlog.length === 0 && <div className="text-xs text-muted-foreground">Nothing waiting to be planned.</div>}
          {backlog.map((t) => <TaskChip key={t.id} task={t} />)}
        </CardContent>
      </Card>

      <div className="lg:col-span-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 min-w-0">
        {days.map((d) => {
          const key = dayKey(d);
          const list = planned.filter((t) => t.planned_date === key);
          return (
            <Card
              key={key}
              className={`min-w-0 ${overKey === key ? "ring-2 ring-primary" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setOverKey(key); }}
              onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
              onDrop={() => { if (dragId) move(dragId, key); setDragId(null); setOverKey(null); }}
            >
              <CardHeader className="py-2">
                <CardTitle className="text-xs flex items-center justify-between gap-1">
                  <span className="truncate">{format(d, "EEE d MMM")}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="secondary">{list.length}</Badge>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onCreateForDay(key)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 min-h-[80px] max-h-[60vh] overflow-y-auto">
                {list.map((t) => <TaskChip key={t.id} task={t} showRemove />)}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyPlanBoard;
