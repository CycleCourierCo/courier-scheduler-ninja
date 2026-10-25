import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listRepairs } from "@/services/fleetRepairService";
import { fleetCostLines, toCsv, type CostLine } from "@/lib/fleet/repairs";

const money = (n: number) => n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });

export default function CostsPanel({ vehicleId, reg }: { vehicleId: string; reg: string }) {
  const [lines, setLines] = useState<CostLine[]>([]);
  useEffect(() => {
    Promise.all([listRepairs(vehicleId), (supabase as any).from("vehicle_maintenance_logs").select("service_date, service_type, custom_name, cost, repair_job_id").eq("vehicle_id", vehicleId)])
      .then(([r, s]) => setLines(fleetCostLines(r, s.data ?? [])))
      .catch((e) => toast.error(e.message));
  }, [vehicleId]);

  const total = lines.reduce((a, l) => a + l.cost, 0);
  const year = new Date().getFullYear().toString();
  const ytd = lines.filter((l) => l.date.startsWith(year)).reduce((a, l) => a + l.cost, 0);

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(lines, reg)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${reg}-costs.csv` });
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <div><div className="text-xs text-muted-foreground">All time</div><div className="text-xl font-bold">{money(total)}</div></div>
        <div><div className="text-xs text-muted-foreground">This year</div><div className="text-xl font-bold">{money(ytd)}</div></div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv} disabled={!lines.length}><Download className="h-4 w-4 mr-1" />CSV</Button>
      </div>
      <p className="text-xs text-muted-foreground">From repair jobs and service history. A service logged from a repair job is counted once.</p>
      {lines.length === 0 ? <p className="text-sm text-muted-foreground">No costs recorded.</p> : (
        <ul className="divide-y text-sm">{lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-2 py-1.5"><span className="truncate">{l.date} · {l.kind} · {l.description}</span><span className="shrink-0">{money(l.cost)}</span></li>
        ))}</ul>
      )}
    </Card>
  );
}
