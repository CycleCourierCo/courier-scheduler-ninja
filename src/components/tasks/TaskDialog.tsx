import React, { useEffect, useState } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { createTask, updateTask } from "@/services/tasksService";
import { useInternalUsers } from "@/hooks/useTasks";
import { searchOrdersForLink, fetchOrdersByIds } from "@/services/customerServiceInboxService";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TASK_PRIORITIES, TASK_STATUSES, type Task } from "@/types/task";
import { Loader2, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Edit existing
  task?: Task | null;
  // Defaults for new
  defaultOrderId?: string | null;
  defaultConversationId?: string | null;
  defaultTitle?: string;
  defaultDescription?: string;
  onSaved?: (task: Task | null) => void;
}

const schema = z.object({
  title: z.string().trim().min(1, "Title required").max(200),
  description: z.string().max(5000).optional(),
});

const TaskDialog: React.FC<Props> = ({
  open, onOpenChange, task, defaultOrderId = null, defaultConversationId = null,
  defaultTitle = "", defaultDescription = "", onSaved,
}) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: users = [] } = useInternalUsers();
  const isEdit = !!task;

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [priority, setPriority] = useState<Task['priority']>('normal');
  const [status, setStatus] = useState<Task['status']>('open');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [linkedOrderId, setLinkedOrderId] = useState<string | null>(defaultOrderId);
  const [linkedOrderLabel, setLinkedOrderLabel] = useState<string>('');
  const [orderQuery, setOrderQuery] = useState('');
  const [orderResults, setOrderResults] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setStatus(task.status);
      setAssigneeId(task.assignee_id || '');
      setDueDate(task.due_date ? task.due_date.slice(0, 16) : '');
      setLinkedOrderId(task.linked_order_id);
    } else {
      setTitle(defaultTitle);
      setDescription(defaultDescription);
      setPriority('normal');
      setStatus('open');
      setAssigneeId('');
      setDueDate('');
      setLinkedOrderId(defaultOrderId);
    }
    setOrderQuery('');
    setOrderResults([]);
  }, [open, task, defaultTitle, defaultDescription, defaultOrderId]);

  useEffect(() => {
    if (!linkedOrderId) { setLinkedOrderLabel(''); return; }
    fetchOrdersByIds([linkedOrderId]).then(rows => {
      const o = rows[0];
      if (o) setLinkedOrderLabel(o.tracking_number || o.customer_order_number || o.id.slice(0,8));
    }).catch(() => {});
  }, [linkedOrderId]);

  const runOrderSearch = async () => {
    const t = orderQuery.trim();
    if (!t) { setOrderResults([]); return; }
    try { setOrderResults(await searchOrdersForLink(t)); } catch (e: any) { toast.error(e?.message || 'Search failed'); }
  };

  const handleSave = async () => {
    const parsed = schema.safeParse({ title, description });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!user?.id) { toast.error("Not signed in"); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        assignee_id: assigneeId || null,
        linked_order_id: linkedOrderId,
        linked_conversation_id: isEdit ? task!.linked_conversation_id : defaultConversationId,
      };
      let result: Task | null = null;
      if (isEdit && task) {
        await updateTask(task.id, { ...payload, status });
        toast.success("Task updated");
      } else {
        result = await createTask(payload, user.id);
        toast.success("Task created");
      }
      qc.invalidateQueries({ queryKey: ['tasks'] });
      if (task?.id) qc.invalidateQueries({ queryKey: ['task', task.id] });
      onSaved?.(result);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit task' : 'New task'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Short summary" maxLength={200} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Assignee</Label>
              <Select value={assigneeId || 'unassigned'} onValueChange={v => setAssigneeId(v === 'unassigned' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due</Label>
              <Input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={v => setPriority(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isEdit && (
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={v => setStatus(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label>Linked order</Label>
            {linkedOrderId ? (
              <div className="flex items-center justify-between text-sm border rounded p-2 bg-muted/40">
                <span className="truncate">{linkedOrderLabel || linkedOrderId.slice(0,8)}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLinkedOrderId(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search tracking # or order #"
                    value={orderQuery}
                    onChange={e => setOrderQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); runOrderSearch(); } }}
                  />
                  <Button type="button" variant="outline" onClick={runOrderSearch}>Search</Button>
                </div>
                {orderResults.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto border rounded p-1">
                    {orderResults.map(o => (
                      <button
                        type="button"
                        key={o.id}
                        onClick={() => { setLinkedOrderId(o.id); setOrderResults([]); setOrderQuery(''); }}
                        className="w-full text-left text-xs p-2 rounded hover:bg-accent"
                      >
                        <div className="font-medium">{o.tracking_number || o.customer_order_number || o.id.slice(0,8)}</div>
                        <div className="text-muted-foreground truncate">{o.sender?.name} → {o.receiver?.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {isEdit ? 'Save' : 'Create task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDialog;
