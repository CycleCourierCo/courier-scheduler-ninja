import React, { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, CalendarClock } from "lucide-react";
import { addDays, format, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks, useInternalUsers } from "@/hooks/useTasks";
import { updateTask } from "@/services/tasksService";
import { TASK_CATEGORIES } from "@/constants/taskCategories";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/types/task";
import TaskDialog from "@/components/tasks/TaskDialog";
import TaskDetailDrawer from "@/components/tasks/TaskDetailDrawer";
import WeeklyPlanBoard from "@/components/project/WeeklyPlanBoard";
import PendingTasksTable from "@/components/project/PendingTasksTable";
import RecurringTasksTab from "@/components/project/RecurringTasksTab";
import PmDashboard from "@/components/project/PmDashboard";

const ProjectManagement: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: users = [] } = useInternalUsers();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [assignee, setAssignee] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: allTasks = [], isLoading } = useTasks({
    status: status as any,
    priority: priority as any,
    assignee: assignee as any,
    category,
    search: search || undefined,
    userId: user?.id,
  });

  const weekEnd = addDays(weekStart, 6);
  const weekKeys = useMemo(
    () => Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), "yyyy-MM-dd")),
    [weekStart]
  );

  const plannedThisWeek = allTasks.filter((t) => t.planned_date && weekKeys.includes(t.planned_date));
  const backlog = allTasks.filter(
    (t) => !t.planned_date && t.status !== "done" && t.status !== "cancelled"
  );
  const pending = allTasks.filter((t) => t.status !== "done" && t.status !== "cancelled");

  const rollToTomorrow = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const stragglers = allTasks.filter(
      (t) => t.planned_date && t.planned_date <= today && t.status !== "done" && t.status !== "cancelled"
    );
    if (!stragglers.length) { toast.info("Nothing left over to move"); return; }
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
    try {
      for (const t of stragglers) await updateTask(t.id, { planned_date: tomorrow } as any);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`${stragglers.length} unfinished task(s) moved to tomorrow`);
    } catch (e: any) {
      toast.error(e?.message || "Could not move those tasks");
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-3 sm:px-6 py-6 space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Project Management</h1>
            <p className="text-muted-foreground text-sm">Plan the week, keep every job moving.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={rollToTomorrow}>
              <CalendarClock className="h-4 w-4 mr-1" /> Roll unfinished to tomorrow
            </Button>
            <Button size="sm" onClick={() => { setCreateDate(null); setCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> New task
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border rounded p-2 bg-muted/30">
          <Input className="w-full sm:w-[200px]" placeholder="Search tasks"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Assignee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Service" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {TASK_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any priority</SelectItem>
              {TASK_PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              {TASK_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="week">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="week">Weekly plan</TabsTrigger>
            <TabsTrigger value="pending">
              Pending tasks <Badge variant="secondary" className="ml-1">{pending.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="repeating">Repeating tasks</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="week" className="space-y-3 pt-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8"
                onClick={() => setWeekStart(addDays(weekStart, -7))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium">
                {format(weekStart, "d MMM")} – {format(weekEnd, "d MMM yyyy")}
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8"
                onClick={() => setWeekStart(addDays(weekStart, 7))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm"
                onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
                This week
              </Button>
            </div>
            <WeeklyPlanBoard
              weekStart={weekStart}
              planned={plannedThisWeek}
              backlog={backlog}
              onOpenTask={setSelectedId}
              onCreateForDay={(d) => { setCreateDate(d); setCreateOpen(true); }}
            />
          </TabsContent>

          <TabsContent value="pending" className="pt-3">
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <PendingTasksTable tasks={pending} onOpenTask={setSelectedId} />
            )}
          </TabsContent>

          <TabsContent value="repeating" className="pt-3">
            <RecurringTasksTab />
          </TabsContent>

          <TabsContent value="dashboard" className="pt-3">
            <PmDashboard tasks={allTasks} />
          </TabsContent>
        </Tabs>
      </div>

      <TaskDialog open={createOpen} onOpenChange={setCreateOpen} defaultPlannedDate={createDate} />
      <TaskDetailDrawer taskId={selectedId} onOpenChange={(o) => !o && setSelectedId(null)} />
    </Layout>
  );
};

export default ProjectManagement;
