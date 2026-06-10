import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, Pencil, Trash2 } from "lucide-react";
import { useTask, useTaskComments } from "@/hooks/useTasks";
import { addTaskComment, deleteTask, updateTask } from "@/services/tasksService";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TASK_STATUSES } from "@/types/task";
import { format } from "date-fns";
import TaskStatusBadge from "./TaskStatusBadge";
import TaskPriorityBadge from "./TaskPriorityBadge";
import TaskDialog from "./TaskDialog";
import { hasRole } from "@/lib/roles";

interface Props {
  taskId: string | null;
  onOpenChange: (open: boolean) => void;
}

const TaskDetailDrawer: React.FC<Props> = ({ taskId, onOpenChange }) => {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  const { data: task } = useTask(taskId || undefined);
  const { data: comments = [] } = useTaskComments(taskId || undefined);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const isAdmin = hasRole(userProfile, 'admin');

  const post = async () => {
    if (!comment.trim() || !user?.id || !taskId) return;
    setPosting(true);
    try {
      await addTaskComment(taskId, comment.trim(), user.id);
      setComment('');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add comment');
    } finally { setPosting(false); }
  };

  const handleStatus = async (status: string) => {
    if (!taskId) return;
    try {
      await updateTask(taskId, { status: status as any });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    } catch (e: any) { toast.error(e?.message || 'Failed to update'); }
  };

  const handleDelete = async () => {
    if (!taskId) return;
    if (!confirm('Delete this task?')) return;
    try {
      await deleteTask(taskId);
      toast.success('Task deleted');
      qc.invalidateQueries({ queryKey: ['tasks'] });
      onOpenChange(false);
    } catch (e: any) { toast.error(e?.message || 'Failed to delete'); }
  };

  return (
    <>
      <Sheet open={!!taskId} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {task && (
            <>
              <SheetHeader>
                <SheetTitle className="pr-8">{task.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <TaskStatusBadge status={task.status} />
                  <TaskPriorityBadge priority={task.priority} />
                  {task.due_date && (
                    <span className="text-xs text-muted-foreground">
                      Due {format(new Date(task.due_date), 'PP p')}
                    </span>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {TASK_STATUSES.map(s => (
                    <Button
                      key={s.value}
                      size="sm"
                      variant={task.status === s.value ? 'default' : 'outline'}
                      onClick={() => handleStatus(s.value)}
                      className="h-7 text-xs"
                    >{s.label}</Button>
                  ))}
                </div>

                {task.description && (
                  <div className="text-sm whitespace-pre-wrap border rounded p-3 bg-muted/30">
                    {task.description}
                  </div>
                )}

                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Assignee: {task.assignee?.name || task.assignee?.email || 'Unassigned'}</div>
                  <div>Created by: {task.creator?.name || task.creator?.email || '—'}</div>
                  <div>Created: {format(new Date(task.created_at), 'PP p')}</div>
                </div>

                {task.linked_order_id && (
                  <Link to={`/orders/${task.linked_order_id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    Open linked order <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                {task.linked_conversation_id && (
                  <div>
                    <Link to={`/inbox/${task.linked_conversation_id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                      Open conversation <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  {isAdmin && (
                    <Button size="sm" variant="destructive" onClick={handleDelete}>
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  )}
                </div>

                <div className="border-t pt-4">
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Comments</div>
                  <div className="space-y-2 mb-3">
                    {comments.length === 0 && <div className="text-xs text-muted-foreground">No comments yet.</div>}
                    {comments.map(c => (
                      <div key={c.id} className="text-sm border rounded p-2">
                        <div className="text-[11px] text-muted-foreground mb-1">
                          {c.author?.name || c.author?.email || '—'} · {format(new Date(c.created_at), 'PP p')}
                        </div>
                        <div className="whitespace-pre-wrap">{c.body}</div>
                      </div>
                    ))}
                  </div>
                  <Textarea
                    rows={2}
                    placeholder="Add a comment…"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" onClick={post} disabled={posting || !comment.trim()}>
                      {posting && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Post
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <TaskDialog open={editOpen} onOpenChange={setEditOpen} task={task || null} />
    </>
  );
};

export default TaskDetailDrawer;
