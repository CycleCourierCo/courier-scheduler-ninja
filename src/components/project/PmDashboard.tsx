import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, startOfWeek, addDays } from "date-fns";
import { TASK_CATEGORIES, categoryLabel } from "@/constants/taskCategories";
import type { Task } from "@/types/task";

interface Props { tasks: Task[] }

const useServiceCounts = () =>
  useQuery({
    queryKey: ["pm-service-counts"],
    queryFn: async () => {
      const [box, foam, insp] = await Promise.all([
        (supabase as any).from("orders").select("box_my_bike_status").not("box_my_bike_status", "is", null).limit(2000),
        (supabase as any).from("orders").select("foam_status").not("foam_status", "is", null).limit(2000),
        (supabase as any).from("bicycle_inspections").select("status").limit(2000),
      ]);
      const tally = (rows: any[] | null, key: string) => {
        const out: Record<string, number> = {};
        (rows || []).forEach((r) => {
          const v = r?.[key];
          if (!v) return;
          out[v] = (out[v] || 0) + 1;
        });
        return out;
      };
      return {
        boxing: tally(box.data, "box_my_bike_status"),
        foaming: tally(foam.data, "foam_status"),
        inspections: tally(insp.data, "status"),
      };
    },
    staleTime: 60_000,
  });

const CountList: React.FC<{ title: string; counts: Record<string, number> }> = ({ title, counts }) => {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (
    <Card className="min-w-0">
      <CardHeader className="py-3"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1 text-xs max-h-56 overflow-y-auto">
        {entries.length === 0 && <div className="text-muted-foreground">Nothing in progress.</div>}
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2">
            <span className="truncate capitalize">{k.replace(/_/g, " ")}</span>
            <Badge variant="secondary">{v}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

const PmDashboard: React.FC<Props> = ({ tasks }) => {
  const { data: services } = useServiceCounts();

  const active = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const done = tasks.filter((t) => t.status === "done");
  const overdue = active.filter((t) => t.due_date && isPast(new Date(t.due_date)));
  const unassigned = active.filter((t) => !t.assignee_id);

  const byCategory = TASK_CATEGORIES.map((c) => ({
    label: c.label,
    outstanding: active.filter((t) => t.category === c.value).length,
    completed: done.filter((t) => t.category === c.value).length,
  })).filter((r) => r.outstanding || r.completed);

  const uncatOutstanding = active.filter((t) => !t.category).length;
  const uncatDone = done.filter((t) => !t.category).length;
  if (uncatOutstanding || uncatDone) {
    byCategory.push({ label: categoryLabel(null), outstanding: uncatOutstanding, completed: uncatDone });
  }

  const people = Object.values(
    active.reduce<Record<string, { name: string; count: number; overdue: number }>>((acc, t) => {
      const key = t.assignee_id || "unassigned";
      const name = t.assignee?.name || t.assignee?.email || "Unassigned";
      acc[key] = acc[key] || { name, count: 0, overdue: 0 };
      acc[key].count += 1;
      if (t.due_date && isPast(new Date(t.due_date))) acc[key].overdue += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-4 min-w-0">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Outstanding tasks", value: active.length },
          { label: "Overdue", value: overdue.length },
          { label: "Unassigned", value: unassigned.length },
          { label: "Completed", value: done.length },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="py-3"><CardTitle className="text-sm">By service</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            {byCategory.length === 0 && <div className="text-muted-foreground">No tasks yet.</div>}
            {byCategory.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-2">
                <span className="truncate">{r.label}</span>
                <span className="shrink-0 flex gap-1">
                  <Badge variant="secondary">{r.outstanding} open</Badge>
                  <Badge variant="outline">{r.completed} done</Badge>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="py-3"><CardTitle className="text-sm">By person</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs max-h-64 overflow-y-auto">
            {people.length === 0 && <div className="text-muted-foreground">No open tasks.</div>}
            {people.map((p) => (
              <div key={p.name} className="flex items-center justify-between gap-2">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 flex gap-1">
                  <Badge variant="secondary">{p.count}</Badge>
                  {p.overdue > 0 && <Badge variant="destructive">{p.overdue} late</Badge>}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader className="py-3"><CardTitle className="text-sm">This week, day by day</CardTitle></CardHeader>
        <CardContent className="grid gap-2 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 text-xs">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const dayTasks = tasks.filter((t) => t.planned_date === key);
            const dayDone = dayTasks.filter((t) => t.status === "done").length;
            return (
              <div key={key} className="border rounded p-2">
                <div className="font-medium">{format(d, "EEE d")}</div>
                <div className="text-muted-foreground">{dayTasks.length} planned</div>
                <div className="text-muted-foreground">{dayDone} done</div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        <CountList title="Bike boxing" counts={services?.boxing || {}} />
        <CountList title="Foaming" counts={services?.foaming || {}} />
        <CountList title="Inspections / servicing" counts={services?.inspections || {}} />
      </div>
    </div>
  );
};

export default PmDashboard;
