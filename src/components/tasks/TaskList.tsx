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

const personName = (p?: { name: string | null; email: string | null } | null) => p?.name || p?.email || null;

const TaskList: React.FC<Props> = ({ tasks, loading, onSelect }) => {
  if (loading) return <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!tasks.length) return <div className="p-6 text-center text-sm text-muted-foreground">No tasks.</div>;

  const isOverdue = (t: Task) => !!t.due_date && !['done', 'cancelled'].includes(t.status) && isPast(new Date(t.due_date));

  return (
    <>
      {/* Phones and small tablets: stacked cards, nothing wider than the screen */}
      <ul className="divide-y md:hidden">
        {tasks.map(t => {
          const overdue = isOverdue(t);
          const assignee = personName(t.assignee);
          const creator = personName(t.creator);
          return (
            <li key={t.id}>
              <button type="button" onClick={() => onSelect(t.id)} className="w-full min-w-0 space-y-2 p-3 text-left active:bg-accent">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <span className="min-w-0 break-words font-medium">{t.title}</span>
                  {(t.linked_order_id || t.linked_conversation_id) && <LinkIcon className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" aria-label="Linked" />}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <TaskStatusBadge status={t.status} />
                  <TaskPriorityBadge priority={t.priority} />
                  {t.due_date && (
                    <span className={`text-xs ${overdue ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                      Due {format(new Date(t.due_date), 'd MMM')}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="text-muted-foreground">Assigned to</div>
                    <div className="truncate">{assignee || '—'}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-muted-foreground">Created by</div>
                    <div className="truncate">{creator || '—'}</div>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Larger screens: table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead className="w-[90px]">Priority</TableHead>
              <TableHead className="w-[150px]">Assignee</TableHead>
              <TableHead className="w-[150px]">Created by</TableHead>
              <TableHead className="w-[120px]">Due</TableHead>
              <TableHead className="w-[60px]">Links</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map(t => {
              const overdue = isOverdue(t);
              return (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => onSelect(t.id)}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell><TaskStatusBadge status={t.status} /></TableCell>
                  <TableCell><TaskPriorityBadge priority={t.priority} /></TableCell>
                  <TableCell className="text-sm">{personName(t.assignee) || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm">{personName(t.creator) || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className={`text-xs ${overdue ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
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
      </div>
    </>
  );
};

export default TaskList;
