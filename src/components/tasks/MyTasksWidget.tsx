import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { CheckSquare, ExternalLink } from "lucide-react";
import { format, isPast } from "date-fns";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/contexts/AuthContext";
import TaskStatusBadge from "./TaskStatusBadge";
import TaskDetailDrawer from "./TaskDetailDrawer";

const MyTasksWidget: React.FC = () => {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: tasks = [] } = useTasks({
    assignee: 'mine', userId: user?.id, status: 'active',
  });

  const sorted = [...tasks].sort((a,b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  }).slice(0, 8);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" /> My tasks
        </CardTitle>
        <Link to="/tasks" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
          View all <ExternalLink className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {sorted.length === 0 && (
          <div className="text-xs text-muted-foreground">No open tasks assigned to you.</div>
        )}
        {sorted.map(t => {
          const overdue = t.due_date && isPast(new Date(t.due_date));
          return (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className="w-full text-left text-sm border rounded p-2 hover:bg-accent flex items-center justify-between gap-2"
            >
              <span className="truncate flex-1">{t.title}</span>
              <div className="flex items-center gap-2 shrink-0">
                {t.due_date && (
                  <span className={`text-[11px] ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                    {format(new Date(t.due_date), 'MMM d')}
                  </span>
                )}
                <TaskStatusBadge status={t.status} />
              </div>
            </button>
          );
        })}
      </CardContent>
      <TaskDetailDrawer taskId={selectedId} onOpenChange={(o) => !o && setSelectedId(null)} />
    </Card>
  );
};

export default MyTasksWidget;
