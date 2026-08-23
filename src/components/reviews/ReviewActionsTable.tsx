import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { ACTION_STATUS_LABELS, type ReviewAction, type ReviewActionOwner, type ReviewActionStatus } from "@/types/review";

interface Props {
  actions: ReviewAction[];
  canEdit: boolean;
  canUpdateStatus?: boolean;
  onAdd: (a: { description: string; owner: ReviewActionOwner; due_date: string | null }) => void;
  onUpdate: (id: string, updates: { status?: ReviewActionStatus }) => void;
  onDelete: (id: string) => void;
}

const statusVariant = (s: ReviewActionStatus) =>
  s === "complete" ? "default" : s === "in_progress" ? "secondary" : "outline";

const ReviewActionsTable: React.FC<Props> = ({ actions, canEdit, canUpdateStatus, onAdd, onUpdate, onDelete }) => {
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState<ReviewActionOwner>("employee");
  const [due, setDue] = useState("");

  const submit = () => {
    if (!description.trim()) return;
    onAdd({ description: description.trim(), owner, due_date: due || null });
    setDescription(""); setDue("");
  };

  return (
    <div className="space-y-3">
      {actions.length === 0 && (
        <p className="text-sm text-muted-foreground">No objectives or actions agreed yet.</p>
      )}

      <div className="space-y-2">
        {actions.map(a => (
          <div key={a.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium">{a.description}</div>
              <div className="text-xs text-muted-foreground">
                Owner: {a.owner === "employee" ? "Employee" : "Manager"}
                {a.due_date && ` · Due ${new Date(a.due_date).toLocaleDateString("en-GB")}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canEdit || canUpdateStatus ? (
                <Select value={a.status} onValueChange={v => onUpdate(a.id, { status: v as ReviewActionStatus })}>
                  <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTION_STATUS_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant={statusVariant(a.status)}>{ACTION_STATUS_LABELS[a.status]}</Badge>
              )}
              {canEdit && (
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onDelete(a.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="grid gap-2 sm:grid-cols-[1fr_140px_160px_auto]">
          <Input placeholder="Action or objective" value={description} onChange={e => setDescription(e.target.value)} />
          <Select value={owner} onValueChange={v => setOwner(v as ReviewActionOwner)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={due} onChange={e => setDue(e.target.value)} />
          <Button onClick={submit}><Plus className="mr-1 h-4 w-4" /> Add</Button>
        </div>
      )}
    </div>
  );
};

export default ReviewActionsTable;
