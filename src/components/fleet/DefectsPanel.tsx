import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listDefects, updateDefect, uploadFleetFile, openFleetFile, listFleetStaff, type Defect } from "@/services/fleetInspectionService";
import { DEFECT_STATUSES, SEVERITY_RAG, closeDefectError, defectStatusLabel, isDefectOpen } from "@/lib/fleet/defects";

export default function DefectsPanel({ vehicleId, onChange }: { vehicleId: string; onChange?: () => void }) {
  const [rows, setRows] = useState<Defect[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string | null }[]>([]);
  const [edit, setEdit] = useState<Partial<Defect> | null>(null);
  const [saving, setSaving] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const load = () => listDefects(vehicleId).then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => { load(); listFleetStaff().then(setStaff).catch(() => {}); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vehicleId]);

  const save = async () => {
    if (!edit) return;
    if (!edit.title?.trim()) return toast.error("Give the defect a title");
    if (edit.status === "resolved") { const err = closeDefectError(edit as Defect); if (err) return toast.error(err); }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const closing = edit.status === "resolved";
      const patch: any = {
        title: edit.title, description: edit.description || null, severity: edit.severity, status: edit.status,
        category: edit.category || null, assigned_to: edit.assigned_to || null,
        rectification_evidence: edit.rectification_evidence || null, verified_by_name: edit.verified_by_name || null,
        verified_at: edit.verified_by_name ? edit.verified_at ?? new Date().toISOString() : null,
        attachments: edit.attachments ?? [],
        resolved_at: closing ? edit.resolved_at ?? new Date().toISOString() : null,
        resolved_by: closing ? u.user?.id ?? null : null,
      };
      if (edit.id) await updateDefect(edit.id, patch);
      else { const { error } = await (supabase as any).from("vehicle_issues").insert({ ...patch, vehicle_id: vehicleId }); if (error) throw new Error(error.message); }
      toast.success("Defect saved"); setEdit(null); load(); onChange?.();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const attach = async (files: FileList | null) => {
    if (!files || !edit) return;
    try {
      const up = await Promise.all([...files].map((f) => uploadFleetFile(vehicleId, f)));
      setEdit({ ...edit, attachments: [...(edit.attachments ?? []), ...up] });
    } catch (e) { toast.error(`Upload failed — ${(e as Error).message}`); }
  };

  const visible = rows.filter((r) => showClosed || isDefectOpen(r.status));
  const staffName = (id: string | null) => staff.find((s) => s.id === id)?.name ?? null;

  return (
    <Card className="p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setEdit({ severity: "medium", status: "open", attachments: [] })}><Plus className="h-4 w-4 mr-1" />Report defect</Button>
        <Button size="sm" variant="ghost" onClick={() => setShowClosed((s) => !s)}>{showClosed ? "Hide closed" : "Show closed"}</Button>
      </div>
      {visible.length === 0 ? <p className="text-sm text-muted-foreground">No {showClosed ? "" : "open "}defects.</p> : (
        <ul className="divide-y text-sm">
          {visible.map((d) => (
            <li key={d.id}>
              <button className="w-full text-left py-2 flex items-start justify-between gap-2" onClick={() => setEdit(d)}>
                <span className="min-w-0">
                  <span className={`block font-medium ${isDefectOpen(d.status) ? "" : "line-through text-muted-foreground"}`}>{d.title}</span>
                  <span className="block text-xs text-muted-foreground">{[d.category, defectStatusLabel(d.status), staffName(d.assigned_to) && `Assigned: ${staffName(d.assigned_to)}`].filter(Boolean).join(" · ")}</span>
                </span>
                <Badge variant={SEVERITY_RAG[d.severity]?.variant ?? "secondary"}>{SEVERITY_RAG[d.severity]?.label ?? d.severity}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Defect" : "Report defect"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="space-y-1"><Label htmlFor="dt">Title</Label><Input id="dt" value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="dd">Details</Label><Textarea id="dd" rows={2} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>Severity</Label>
                  <Select value={edit.severity} onValueChange={(v) => setEdit({ ...edit, severity: v as Defect["severity"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(["high", "medium", "low"] as const).map((s) => <SelectItem key={s} value={s}>{SEVERITY_RAG[s].label}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="space-y-1"><Label>Status</Label>
                  <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DEFECT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
              <div className="space-y-1"><Label>Assigned to</Label>
                <Select value={edit.assigned_to ?? "none"} onValueChange={(v) => setEdit({ ...edit, assigned_to: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Nobody</SelectItem>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name ?? "Unnamed"}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1"><Label htmlFor="ev">Rectification evidence{edit.severity === "high" ? " (needed to close)" : ""}</Label>
                <Textarea id="ev" rows={2} placeholder="What was done, invoice or job number" value={edit.rectification_evidence ?? ""} onChange={(e) => setEdit({ ...edit, rectification_evidence: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="vb">Verified by{edit.severity === "high" ? " (needed to close)" : ""}</Label>
                <Input id="vb" value={edit.verified_by_name ?? ""} onChange={(e) => setEdit({ ...edit, verified_by_name: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Photos and documents</Label>
                <ul className="text-sm space-y-1">
                  {(edit.attachments ?? []).map((a) => (
                    <li key={a.path} className="flex justify-between gap-2">
                      <button className="underline truncate" onClick={() => openFleetFile(a.path).catch((e) => toast.error(e.message))}>{a.name}</button>
                      <button className="text-xs text-muted-foreground" onClick={() => setEdit({ ...edit, attachments: edit.attachments!.filter((x) => x.path !== a.path) })}>Remove</button>
                    </li>
                  ))}
                </ul>
                <label className="inline-flex items-center gap-1 text-sm cursor-pointer underline"><Paperclip className="h-4 w-4" />Add files
                  <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => attach(e.target.files)} /></label>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={save} disabled={saving}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
