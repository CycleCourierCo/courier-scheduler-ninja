import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  finishRun,
  startRun,
  toggleRunItem,
  updateRunItemNote,
  deleteRun,
} from "@/services/knowledgeService";
import { useKbChecklist, useKbRuns } from "@/hooks/useKnowledge";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  articleId: string;
  articleTitle: string;
  onChanged: () => void;
}

const ChecklistPanel = ({ articleId, articleTitle, onChanged }: Props) => {
  const { user } = useAuth();
  const { data: items = [] } = useKbChecklist(articleId);
  const { data: runs = [], refetch } = useKbRuns({ articleId });
  const [busy, setBusy] = useState(false);

  const openRun = runs.find((r) => !r.completed_at && r.user_id === user?.id);

  const handleStart = async () => {
    setBusy(true);
    try {
      await startRun(articleId, articleTitle);
      await refetch();
      onChanged();
      toast.success("Checklist started");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start the checklist");
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (itemId: string, done: boolean) => {
    try {
      await toggleRunItem(itemId, done);
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update the step");
    }
  };

  const handleFinish = async (runId: string) => {
    try {
      await finishRun(runId);
      await refetch();
      onChanged();
      toast.success("Checklist completed");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not complete the checklist");
    }
  };

  const handleDelete = async (runId: string) => {
    try {
      await deleteRun(runId);
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not remove the run");
    }
  };

  if (!items.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Checklist ({items.length} steps)</CardTitle>
          {!openRun && (
            <Button size="sm" onClick={handleStart} disabled={busy}>
              <Play className="mr-2 h-4 w-4" /> Start checklist
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!openRun && (
          <ol className="space-y-2 text-sm">
            {items.map((i, idx) => (
              <li key={i.id} className="flex gap-2">
                <span className="w-5 shrink-0 text-muted-foreground">{idx + 1}.</span>
                <span className="min-w-0 break-words">
                  {i.text}
                  {i.guidance && (
                    <span className="block text-xs text-muted-foreground">{i.guidance}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}

        {openRun && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary">
                In progress — started {format(new Date(openRun.started_at), "d MMM HH:mm")}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => handleFinish(openRun.id)}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Mark complete
              </Button>
            </div>
            <div className="space-y-2">
              {(openRun.items ?? []).map((ri) => (
                <div key={ri.id} className="rounded-md border border-border p-2">
                  <label className="flex items-start gap-2">
                    <Checkbox
                      checked={ri.done}
                      onCheckedChange={(v) => handleToggle(ri.id, !!v)}
                      className="mt-0.5"
                    />
                    <span
                      className={`min-w-0 break-words text-sm ${
                        ri.done ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {ri.text}
                    </span>
                  </label>
                  <Input
                    defaultValue={ri.note ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (ri.note ?? "")) {
                        updateRunItemNote(ri.id, e.target.value).catch(() => {});
                      }
                    }}
                    placeholder="Note (optional)"
                    className="mt-2 h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {runs.filter((r) => r.completed_at).length > 0 && (
          <div className="space-y-1 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">Recent runs</p>
            {runs
              .filter((r) => r.completed_at)
              .slice(0, 5)
              .map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 break-words text-muted-foreground">
                    Completed {format(new Date(r.completed_at as string), "d MMM yyyy HH:mm")} —{" "}
                    {(r.items ?? []).filter((i) => i.done).length}/{(r.items ?? []).length} steps
                  </span>
                  {r.user_id === user?.id && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ChecklistPanel;
