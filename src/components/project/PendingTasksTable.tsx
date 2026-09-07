import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isPast } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { updateTask } from "@/services/tasksService";
import { categoryLabel } from "@/constants/taskCategories";
import TaskStatusBadge from "@/components/tasks/TaskStatusBadge";
import TaskPriorityBadge from "@/components/tasks/TaskPriorityBadge";
import type { Task } from "@/types/task";

interface Props {
  tasks: Task[];
  onOpenTask: (id: string) => void;
}

const PendingTasksTable: React.FC<Props> = ({ tasks, onOpenTask }) => {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkDate, setBulkDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [bulkAssignee, setBulkAssignee] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const allSelected = tasks.length > 0 && selected.length === tasks.length;

  const runBulk = async (patch: Record<string, unknown>, message: string) => {
    if (!selected.length) { toast.error("Pick some tasks first"); return; }
    setBusy(true);
    try {
      for (const id of selected) await updateTask(id, patch as any);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(message);
      setSelected([]);
    } catch (e: any) {
      toast.error(e?.message || "Bulk update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-end gap-2 border rounded p-2 bg-muted/30">
        <div className="text-xs text-muted-foreground self-center">{selected.length} selected</div>
        <div className="flex items-end gap-2">
          <Input type="date" className="w-[150px]" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
          <Button size="sm" variant="outline" disabled={busy}
            onClick={() => runBulk({ planned_date: bulkDate }, "Added to the plan")}>
            Add to day
          </Button>
        </div>
        <Button size="sm" variant="outline" disabled={busy}
          onClick={() => runBulk({ planned_date: null }, "Removed from the plan")}>
          Clear planned day
        </Button>
        <Button size="sm" variant="outline" disabled={busy}
          onClick={() => runBulk({ status: "done", completed_at: new Date().toISOString() }, "Marked done")}>
          Mark done
        </Button>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr>
              <th className="p-2 w-8">
                <Checkbox checked={allSelected}
                  onCheckedChange={(v) => setSelected(v ? tasks.map((t) => t.id) : [])} />
              </th>
              <th className="p-2 text-left">Task</th>
              <th className="p-2 text-left">Service</th>
              <th className="p-2 text-left">Assignee</th>
              <th className="p-2 text-left">Planned</th>
              <th className="p-2 text-left">Due</th>
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr><td colSpan={7} className="p-4 text-center text-xs text-muted-foreground">No tasks match these filters.</td></tr>
            )}
            {tasks.map((t) => {
              const overdue = t.due_date && isPast(new Date(t.due_date)) && t.status !== "done";
              return (
                <tr key={t.id} className="border-t hover:bg-accent/40">
                  <td className="p-2"><Checkbox checked={selected.includes(t.id)} onCheckedChange={() => toggle(t.id)} /></td>
                  <td className="p-2 min-w-[180px]">
                    <button className="text-left hover:underline" onClick={() => onOpenTask(t.id)}>{t.title}</button>
                    <div className="mt-1"><TaskPriorityBadge priority={t.priority} /></div>
                  </td>
                  <td className="p-2 text-xs">{categoryLabel(t.category)}</td>
                  <td className="p-2 text-xs">{t.assignee?.name || t.assignee?.email || "Unassigned"}</td>
                  <td className="p-2 text-xs">{t.planned_date ? format(new Date(`${t.planned_date}T00:00:00`), "EEE d MMM") : "—"}</td>
                  <td className={`p-2 text-xs ${overdue ? "text-red-600 font-medium" : ""}`}>
                    {t.due_date ? format(new Date(t.due_date), "d MMM HH:mm") : "—"}
                  </td>
                  <td className="p-2"><TaskStatusBadge status={t.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PendingTasksTable;
