import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, RefreshCw, Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useInternalUsers } from "@/hooks/useTasks";
import { useRecurrences, useRecurrenceMutations } from "@/hooks/useRecurringTasks";
import { nextRunDate } from "@/services/recurringTasksService";
import { TASK_CATEGORIES, categoryLabel } from "@/constants/taskCategories";
import { RECURRENCE_FREQUENCIES, TASK_PRIORITIES, type RecurrenceFrequency, type TaskRecurrence } from "@/types/task";
import { ALL_ROLES } from "@/lib/roles";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const emptyForm = {
  title: "",
  description: "",
  category: "",
  priority: "normal",
  assigneeMode: "person" as "person" | "role",
  assignee_id: "",
  assignee_role: "",
  frequency: "weekdays" as RecurrenceFrequency,
  interval_n: 1,
  days_of_week: [] as number[],
  start_date: format(new Date(), "yyyy-MM-dd"),
  end_date: "",
  active: true,
};

const RecurringTasksTab: React.FC = () => {
  const { user } = useAuth();
  const { data: users = [] } = useInternalUsers();
  const { data: recurrences = [], isLoading } = useRecurrences();
  const { create, update, remove, generate } = useRecurrenceMutations();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRecurrence | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const openNew = () => { setEditing(null); setForm({ ...emptyForm }); setOpen(true); };
  const openEdit = (r: TaskRecurrence) => {
    setEditing(r);
    setForm({
      title: r.title,
      description: r.description || "",
      category: r.category || "",
      priority: r.priority,
      assigneeMode: r.assignee_role ? "role" : "person",
      assignee_id: r.assignee_id || "",
      assignee_role: r.assignee_role || "",
      frequency: r.frequency,
      interval_n: r.interval_n || 1,
      days_of_week: r.days_of_week || [],
      start_date: r.start_date,
      end_date: r.end_date || "",
      active: r.active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Give the repeating task a title"); return; }
    if (!user?.id) { toast.error("Not signed in"); return; }
    if ((form.frequency === "days_of_week" || form.frequency === "weekly") && form.days_of_week.length === 0) {
      toast.error("Pick at least one day of the week"); return;
    }
    const input = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category || null,
      priority: form.priority as any,
      assignee_id: form.assigneeMode === "person" ? form.assignee_id || null : null,
      assignee_role: form.assigneeMode === "role" ? form.assignee_role || null : null,
      frequency: form.frequency,
      interval_n: Math.max(1, Number(form.interval_n) || 1),
      days_of_week: form.days_of_week,
      start_date: form.start_date,
      end_date: form.end_date || null,
      active: form.active,
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, patch: input as any });
      else await create.mutateAsync({ input: input as any, userId: user.id });
      toast.success(editing ? "Repeating task updated" : "Repeating task created");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    }
  };

  const describe = (r: TaskRecurrence) => {
    switch (r.frequency) {
      case "weekdays": return "Every working day";
      case "days_of_week": return `Every ${(r.days_of_week || []).map((d) => DAYS[d]).join(", ")}`;
      case "weekly": return `Every ${r.interval_n} week(s) on ${(r.days_of_week || []).map((d) => DAYS[d]).join(", ")}`;
      case "monthly": return `Every ${r.interval_n} month(s)`;
      default: return "";
    }
  };

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap gap-2 justify-between">
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New repeating task</Button>
        <Button size="sm" variant="outline" disabled={generate.isPending}
          onClick={() => generate.mutateAsync().then((r) => toast.success(`${r.created} task(s) created`)).catch((e) => toast.error(e?.message || "Generation failed"))}>
          {generate.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Generate today's tasks
        </Button>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {recurrences.map((r) => (
          <Card key={r.id} className="min-w-0">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-start justify-between gap-2">
                <span className="truncate">{r.title}</span>
                <Badge variant={r.active ? "default" : "secondary"}>{r.active ? "Active" : "Paused"}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <div>{describe(r)}</div>
              <div className="text-muted-foreground">{categoryLabel(r.category)}</div>
              <div>
                For:{" "}
                {r.assignee_role
                  ? `${ALL_ROLES.find((x) => x.value === (r.assignee_role as any))?.label || r.assignee_role} team`
                  : users.find((u) => u.id === r.assignee_id)?.name || users.find((u) => u.id === r.assignee_id)?.email || "Unassigned"}
              </div>
              <div className="text-muted-foreground">
                Next: {nextRunDate(r) ? format(new Date(`${nextRunDate(r)}T00:00:00`), "EEE d MMM") : "—"}
                {r.last_generated_on && ` · last made ${format(new Date(`${r.last_generated_on}T00:00:00`), "d MMM")}`}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={r.active} onCheckedChange={(v) => update.mutate({ id: r.id, patch: { active: v } })} />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                  onClick={() => { if (confirm("Delete this repeating task?")) remove.mutate(r.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && recurrences.length === 0 && (
          <div className="text-sm text-muted-foreground">No repeating tasks yet.</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit repeating task" : "New repeating task"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />
            </div>
            <div>
              <Label>Details</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Service / area</Label>
                <Select value={form.category || "none"} onValueChange={(v) => setForm({ ...form, category: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Uncategorised</SelectItem>
                    {TASK_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assign to</Label>
                <Select value={form.assigneeMode} onValueChange={(v) => setForm({ ...form, assigneeMode: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="person">A named person</SelectItem>
                    <SelectItem value="role">A team / role</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{form.assigneeMode === "person" ? "Person" : "Team"}</Label>
                {form.assigneeMode === "person" ? (
                  <Select value={form.assignee_id || "unassigned"} onValueChange={(v) => setForm({ ...form, assignee_id: v === "unassigned" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={form.assignee_role || "none"} onValueChange={(v) => setForm({ ...form, assignee_role: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Choose a team</SelectItem>
                      {ALL_ROLES.filter((r) => !r.value.includes("customer")).map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label>Repeats</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as RecurrenceFrequency })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {(form.frequency === "weekly" || form.frequency === "monthly") && (
                <div>
                  <Label>Every</Label>
                  <Input type="number" min={1} value={form.interval_n}
                    onChange={(e) => setForm({ ...form, interval_n: Number(e.target.value) })} />
                </div>
              )}
              <div>
                <Label>Starts</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <Label>Ends (optional)</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>

            {(form.frequency === "days_of_week" || form.frequency === "weekly") && (
              <div>
                <Label>Days</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {DAYS.map((d, i) => (
                    <Button key={d} type="button" size="sm"
                      variant={form.days_of_week.includes(i) ? "default" : "outline"}
                      onClick={() => setForm({
                        ...form,
                        days_of_week: form.days_of_week.includes(i)
                          ? form.days_of_week.filter((x) => x !== i)
                          : [...form.days_of_week, i].sort(),
                      })}>
                      {d}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <span className="text-sm">Active</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecurringTasksTab;
