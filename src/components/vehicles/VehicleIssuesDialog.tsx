import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface VehicleIssue {
  id: string;
  vehicle_id: string;
  title: string;
  description: string | null;
  severity: "low" | "medium" | "high";
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
}

interface Props {
  vehicleId: string;
  vehicleReg: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

const db = supabase as any;

const VehicleIssuesDialog = ({ vehicleId, vehicleReg, open, onOpenChange, onChanged }: Props) => {
  const [issues, setIssues] = useState<VehicleIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<VehicleIssue["severity"]>("medium");

  const load = async () => {
    setLoading(true);
    const { data, error } = await db
      .from("vehicle_issues")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error("Couldn't load issues");
    setIssues(data ?? []);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicleId]);

  const raise = async () => {
    if (!title.trim()) return toast.error("Add a short title for the issue");
    setSaving(true);
    const { error } = await db.from("vehicle_issues").insert({
      vehicle_id: vehicleId,
      title: title.trim(),
      description: description.trim() || null,
      severity,
    });
    setSaving(false);
    if (error) return toast.error("Couldn't raise the issue");
    toast.success("Issue raised");
    setTitle(""); setDescription(""); setSeverity("medium");
    load(); onChanged?.();
  };

  const setStatus = async (issue: VehicleIssue, status: VehicleIssue["status"]) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await db.from("vehicle_issues").update(
      status === "resolved"
        ? { status, resolved_at: new Date().toISOString(), resolved_by: u.user?.id ?? null }
        : { status, resolved_at: null, resolved_by: null },
    ).eq("id", issue.id);
    if (error) return toast.error("Couldn't update the issue");
    load(); onChanged?.();
  };

  const sevVariant = (s: string) => (s === "high" ? "destructive" : s === "low" ? "outline" : "secondary");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Issues · {vehicleReg}</DialogTitle></DialogHeader>

        <div className="space-y-3 rounded-md border p-3">
          <div className="space-y-1">
            <Label htmlFor="issue-title">What's wrong?</Label>
            <Input id="issue-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Nearside mirror cracked" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="issue-desc">Details (optional)</Label>
            <Textarea id="issue-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as VehicleIssue["severity"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High — off the road</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={raise} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Raise issue
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : issues.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No issues raised for this van.</p>
        ) : (
          <ul className="space-y-2">
            {issues.map((i) => (
              <li key={i.id} className="rounded-md border p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className={`font-medium ${i.status === "resolved" ? "line-through text-muted-foreground" : ""}`}>{i.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(i.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" })}
                      {i.resolved_at ? ` · resolved ${new Date(i.resolved_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}` : ""}
                    </div>
                  </div>
                  <Badge variant={sevVariant(i.severity) as any}>{i.severity}</Badge>
                </div>
                {i.description && <p className="text-sm whitespace-pre-wrap">{i.description}</p>}
                <div className="flex justify-end">
                  {i.status === "open" ? (
                    <Button size="sm" variant="outline" onClick={() => setStatus(i, "resolved")}>Mark resolved</Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(i, "open")}>Reopen</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VehicleIssuesDialog;
