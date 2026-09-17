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
import {
  DAY_END_MINUTES,
  DAY_START_MINUTES,
  SLOT_COUNT,
  SLOT_HEIGHT,
  SLOT_MINUTES,
  formatLength,
  layOutDay,
  minutesToLabel,
  minutesToTimeValue,
  taskMinutes,
  totalDayMinutes,
} from "@/lib/taskTime";

interface Props {
  weekStart: Date;
  planned: Task[];
  backlog: Task[];
  onOpenTask: (id: string) => void;
  onCreateForDay: (date: string) => void;
}

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");
const GRID_HEIGHT = SLOT_COUNT * SLOT_HEIGHT;
const DAY_LENGTH = DAY_END_MINUTES - DAY_START_MINUTES;

const WeeklyPlanBoard: React.FC<Props> = ({ weekStart, planned, backlog, onOpenTask, onCreateForDay }) => {
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const move = async (taskId: string, date: string | null, startMinutes?: number | null) => {
    try {
      await updateTask(taskId, {
        planned_date: date,
        start_time:
          startMinutes === undefined || startMinutes === null ? null : minutesToTimeValue(startMinutes),
      } as any);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      if (!date) {
        toast.success("Removed from the plan");
      } else {
        const when = format(new Date(`${date}T00:00:00`), "EEE d MMM");
        toast.success(
          startMinutes === undefined || startMinutes === null
            ? `Moved to ${when}`
            : `Moved to ${when} at ${minutesToLabel(startMinutes)}`
        );
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not move that task");
    }
  };

  /** Which 30-minute slot the pointer is over, from the drop target's own box. */
  const slotFromEvent = (e: React.DragEvent<HTMLDivElement>): number => {
    const box = e.currentTarget.getBoundingClientRect();
    const offset = Math.max(0, Math.min(box.height - 1, e.clientY - box.top));
    const slot = Math.floor(offset / SLOT_HEIGHT);
    return DAY_START_MINUTES + slot * SLOT_MINUTES;
  };

  const BacklogChip: React.FC<{ task: Task }> = ({ task }) => (
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
          <div className="text-muted-foreground">{formatLength(taskMinutes(task))}</div>
        </button>
        <TaskPriorityBadge priority={task.priority} />
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
          className="space-y-2 max-h-[70vh] overflow-y-auto"
          onDragOver={(e) => { e.preventDefault(); setOverKey("backlog"); }}
          onDrop={() => { if (dragId) move(dragId, null, null); setDragId(null); setOverKey(null); }}
        >
          {backlog.length === 0 && <div className="text-xs text-muted-foreground">Nothing waiting to be planned.</div>}
          {backlog.map((t) => <BacklogChip key={t.id} task={t} />)}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3 min-w-0">
        <CardContent className="p-2 sm:p-3 overflow-x-auto">
          <div className="min-w-[720px]">
            {/* Day headers */}
            <div className="flex">
              <div className="w-12 shrink-0" />
              {days.map((d) => {
                const key = dayKey(d);
                const list = planned.filter((t) => t.planned_date === key);
                const used = totalDayMinutes(list);
                const over = used > DAY_LENGTH;
                return (
                  <div key={key} className="flex-1 min-w-0 px-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium truncate">{format(d, "EEE d MMM")}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => onCreateForDay(key)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className={`text-[11px] ${over ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {formatLength(used)} of {formatLength(DAY_LENGTH)}
                      {over ? " — overfilled" : ""}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div className="flex mt-1">
              {/* Times down the side */}
              <div className="w-12 shrink-0 relative" style={{ height: GRID_HEIGHT }}>
                {Array.from({ length: SLOT_COUNT }, (_, i) => (
                  <div
                    key={i}
                    className="text-[10px] text-muted-foreground text-right pr-1 leading-none"
                    style={{ height: SLOT_HEIGHT, paddingTop: 2 }}
                  >
                    {i % 2 === 0 ? minutesToLabel(DAY_START_MINUTES + i * SLOT_MINUTES) : ""}
                  </div>
                ))}
              </div>

              {days.map((d) => {
                const key = dayKey(d);
                const list = planned.filter((t) => t.planned_date === key);
                const blocks = layOutDay(list);
                return (
                  <div
                    key={key}
                    className={`flex-1 min-w-0 relative border-l ${overKey === key ? "bg-accent/40" : ""}`}
                    style={{ height: GRID_HEIGHT }}
                    onDragOver={(e) => { e.preventDefault(); setOverKey(key); }}
                    onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragId) move(dragId, key, slotFromEvent(e));
                      setDragId(null);
                      setOverKey(null);
                    }}
                  >
                    {/* Half-hour lines */}
                    {Array.from({ length: SLOT_COUNT }, (_, i) => (
                      <div
                        key={i}
                        className={`absolute left-0 right-0 ${i % 2 === 0 ? "border-t" : "border-t border-dashed"} border-border/60`}
                        style={{ top: i * SLOT_HEIGHT }}
                      />
                    ))}

                    {blocks.map(({ task, start, minutes }) => {
                      const top = ((start - DAY_START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT;
                      const height = Math.max(SLOT_HEIGHT - 2, (minutes / SLOT_MINUTES) * SLOT_HEIGHT - 2);
                      const runsLate = start + minutes > DAY_END_MINUTES;
                      const done = task.status === "done";
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={() => setDragId(task.id)}
                          onDragEnd={() => { setDragId(null); setOverKey(null); }}
                          className={`group absolute left-0.5 right-0.5 rounded border px-1 py-0.5 text-[11px] overflow-hidden cursor-grab
                            ${done ? "bg-muted text-muted-foreground" : runsLate ? "bg-destructive/10 border-destructive/40" : "bg-card hover:bg-accent"}
                            ${dragId === task.id ? "opacity-50" : ""}`}
                          style={{ top, height }}
                          title={`${task.title} · ${minutesToLabel(start)}–${minutesToLabel(start + minutes)} · ${formatLength(minutes)}`}
                        >
                          <div className="flex items-start gap-1">
                            <button className="text-left flex-1 min-w-0" onClick={() => onOpenTask(task.id)}>
                              <div className="font-medium truncate">{task.title}</div>
                              <div className="text-muted-foreground truncate">
                                {minutesToLabel(start)} · {formatLength(minutes)}
                              </div>
                              {height > SLOT_HEIGHT * 1.6 && (
                                <div className="text-muted-foreground truncate">
                                  {task.assignee?.name || task.assignee?.email || "Unassigned"}
                                </div>
                              )}
                            </button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100"
                              onClick={() => move(task.id, null, null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Drag a task onto a time to pin its start; drop it on the backlog to take it off the plan.
              Tasks with no set time queue from {minutesToLabel(DAY_START_MINUTES)} by priority.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WeeklyPlanBoard;
