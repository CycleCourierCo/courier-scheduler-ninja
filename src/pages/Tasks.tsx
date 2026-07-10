import React, { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks, useInternalUsers } from "@/hooks/useTasks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, Plus } from "lucide-react";
import TaskList from "@/components/tasks/TaskList";
import TaskDialog from "@/components/tasks/TaskDialog";
import TaskDetailDrawer from "@/components/tasks/TaskDetailDrawer";
import type { TaskFilters } from "@/types/task";

const Tasks: React.FC = () => {
  const { user } = useAuth();
  const { data: users = [] } = useInternalUsers();

  const [status, setStatus] = useState<TaskFilters['status']>('active');
  const [priority, setPriority] = useState<TaskFilters['priority']>('all');
  const [assignee, setAssignee] = useState<TaskFilters['assignee']>('all');
  const [due, setDue] = useState<TaskFilters['due']>('all');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters: TaskFilters = useMemo(() => ({
    status, priority, assignee, due, search, userId: user?.id,
  }), [status, priority, assignee, due, search, user?.id]);

  const { data: tasks = [], isLoading } = useTasks(filters);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Tasks</h1>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> New task
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="md:col-span-2" />
          <Select value={status} onValueChange={v => setStatus(v as any)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={v => setPriority(v as any)}>
            <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={assignee} onValueChange={v => setAssignee(v as any)}>
            <SelectTrigger><SelectValue placeholder="Assignee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              <SelectItem value="mine">Mine</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={due} onValueChange={v => setDue(v as any)}>
            <SelectTrigger><SelectValue placeholder="Due" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any time</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Next 7 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-md bg-card">
          <TaskList tasks={tasks} loading={isLoading} onSelect={setSelectedId} />
        </div>
      </div>

      <TaskDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TaskDetailDrawer taskId={selectedId} onOpenChange={(o) => !o && setSelectedId(null)} />
    </Layout>
  );
};

export default Tasks;
