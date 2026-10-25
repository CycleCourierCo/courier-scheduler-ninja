import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { listInspections, listTemplates, startInspection, type Inspection, type InspectionTemplate } from "@/services/fleetInspectionService";
import { INSPECTION_RESULT_LABEL } from "@/lib/fleet/inspections";

export default function InspectionsPanel({ vehicleId, odometer }: { vehicleId: string; odometer?: number }) {
  const nav = useNavigate();
  const [items, setItems] = useState<Inspection[]>([]);
  const [tpls, setTpls] = useState<InspectionTemplate[]>([]);
  const [type, setType] = useState("");

  useEffect(() => {
    listInspections(vehicleId).then(setItems).catch((e) => toast.error(e.message));
    listTemplates().then((t) => { const a = t.filter((x) => x.active); setTpls(a); setType(a.find((x) => x.inspection_type === "weekly_visual")?.id ?? a[0]?.id ?? ""); }).catch(() => {});
  }, [vehicleId]);

  const start = async () => {
    const t = tpls.find((x) => x.id === type);
    if (!t) return;
    try { const i = await startInspection(vehicleId, t, odometer); nav(`/fleet/inspections/${i.id}`); }
    catch (e) { toast.error(`Couldn't start — ${(e as Error).message}`); }
  };
  const name = (i: Inspection) => tpls.find((t) => t.id === i.template_id)?.name ?? i.inspection_type;

  return (
    <Card className="p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Inspection type" /></SelectTrigger>
          <SelectContent>{tpls.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={start} disabled={!type}>Start inspection</Button>
      </div>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">No inspections yet.</p> : (
        <ul className="divide-y text-sm">
          {items.map((i) => (
            <li key={i.id}>
              <Link to={`/fleet/inspections/${i.id}`} className="flex items-center justify-between gap-2 py-2 hover:underline">
                <span>{name(i)}{i.supersedes_id ? " (correction)" : ""}</span>
                <span className="flex items-center gap-2 shrink-0">
                  {i.status === "draft" ? <Badge variant="secondary">Draft</Badge>
                    : <Badge variant={i.overall_result === "fail" ? "destructive" : "outline"}>{INSPECTION_RESULT_LABEL[i.overall_result ?? ""] ?? "Final"}</Badge>}
                  <span className="text-xs text-muted-foreground">{new Date(i.inspected_at).toLocaleDateString("en-GB", { timeZone: "Europe/London" })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
