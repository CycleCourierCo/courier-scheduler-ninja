import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { useTaskNotifications } from "@/hooks/useTaskNotifications";
import TaskDetailDrawer from "./TaskDetailDrawer";
import TaskPriorityBadge from "./TaskPriorityBadge";

interface Props {
  /** Render as a full-width row (mobile sheet) instead of an icon button */
  variant?: "icon" | "row";
  onNavigate?: () => void;
}

const TaskNotificationBell: React.FC<Props> = ({ variant = "icon", onNavigate }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { tasks, unseenCount, unseenIds, markAllSeen, isLoading } = useTaskNotifications(user?.id);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void markAllSeen();
  };

  const trigger = variant === "row" ? (
    <button className="flex items-center text-foreground hover:text-courier-500 transition-colors">
      <Bell className="mr-2 h-4 w-4" />
      <span>Notifications</span>
      {unseenCount > 0 && (
        <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
          {unseenCount > 9 ? "9+" : unseenCount}
        </span>
      )}
    </button>
  ) : (
    <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Task notifications">
      <Bell className="h-5 w-5" />
      {unseenCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
          {unseenCount > 9 ? "9+" : unseenCount}
        </span>
      )}
    </Button>
  );

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-0">
          <div className="border-b px-3 py-2 text-sm font-semibold">Your tasks</div>
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</div>
            ) : tasks.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No tasks assigned to you</div>
            ) : (
              tasks.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedId(t.id); setOpen(false); }}
                  className={`w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/60 ${unseenIds.has(t.id) ? "bg-muted/40" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium break-words">{t.title}</span>
                    <TaskPriorityBadge priority={t.priority} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span>
                      {t.creator?.name || t.creator?.email
                        ? `From ${t.creator?.name || t.creator?.email}`
                        : "Assigned"}
                    </span>
                    <span>· {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span>
                    {t.due_date && <span>· Due {format(new Date(t.due_date), "d MMM")}</span>}
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="border-t px-3 py-2">
            <Link
              to="/tasks"
              onClick={() => { setOpen(false); onNavigate?.(); }}
              className="text-sm text-primary hover:underline"
            >
              View all tasks
            </Link>
          </div>
        </PopoverContent>
      </Popover>

      <TaskDetailDrawer taskId={selectedId} onOpenChange={(o) => !o && setSelectedId(null)} />
    </>
  );
};

export default TaskNotificationBell;
