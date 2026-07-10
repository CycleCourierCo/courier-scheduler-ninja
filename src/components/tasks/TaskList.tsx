import React from "react";
import { format, isPast } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TaskStatusBadge from "./TaskStatusBadge";
import TaskPriorityBadge from "./TaskPriorityBadge";
import type { Task } from "@/types/task";
import { Link as LinkIcon } from "lucide-react";

interface Props {
  tasks: Task[];
  loading?: boolean;
  onSelect: (id: string) => void;
}

const TaskList: React.FC<Props> = ({ tasks, loading, onSelect }) => {
  if (loading) return <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!tasks.length) return <div className="p-6 text-center text-sm text-muted-foreground">No tasks.</div>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead className="w-[110px]">Status</TableHead>
          <TableHead className="w-[90px]">Priority</TableHead>
          <TableHead className="w-[160px]">Assignee</TableHead>
          <TableHead className="w-[150px]">Due</TableHead>
          <TableHead className="w-[80px]">Links</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map(t => {
          const overdue = t.due_date && !['done','cancelled'].includes(t.status) && isPast(new Date(t.due_date));
          return (
            <TableRow key={t.id} className="cursor-pointer" onClick={() => onSelect(t.id)}>
              <TableCell className="font-medium">{t.title}</TableCell>
              <TableCell><TaskStatusBadge status={t.status} /></TableCell>
              <TableCell><TaskPriorityBadge priority={t.priority} /></TableCell>
              <TableCell className="text-sm">{t.assignee?.name || t.assignee?.email || <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                {t.due_date ? format(new Date(t.due_date), 'PP') : '—'}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {t.linked_order_id && <LinkIcon className="h-3 w-3" />}
                  {t.linked_conversation_id && <LinkIcon className="h-3 w-3" />}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default TaskList;
