import { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { Download } from "lucide-react";
import Layout from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouteDay, type RouteAnalysis } from "@/components/fleet/RouteOverlay";
import { compareStops, summarise, milesDifference } from "@/lib/fleet/routeReport";

const hhmm = (t: number | null) => (t ? format(new Date(t), "HH:mm") : null);

function buildRows(a: RouteAnalysis) {
  const actual: Record<string, string> = {};
  for (const s of a.stops) if (s.visitedAt) actual[`${s.orderId ?? ""}:${s.type ?? ""}`] = hhmm(s.visitedAt)!;
  return compareStops(a.stops, a.doneStops ?? [], actual);
}

export default function RouteReport() {
  const [params, setParams] = useSearchParams();
  const date = params.get("date") || format(new Date(), "yyyy-MM-dd");
  const { analyses, isLoading } = useRouteDay(date);
  const reports = useMemo(() => analyses.map((a) => ({ a, rows: buildRows(a) })), [analyses]);

  const downloadCsv = () => {
    const lines = [["Van", "Driver", "Route", "Stop", "Type", "Address", "Outcome", "Planned time", "Actual time", "Late (min)"].join(",")];
    for (const { a, rows } of reports) for (const r of rows)
      lines.push([a.registration, a.driver ?? "", a.name ?? "", r.orderId, r.type, r.address, r.outcome, r.plannedTime ?? "", r.actualTime ?? "", r.lateMinutes ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const el = document.createElement("a"); el.href = url; el.download = `route-report-${date}.csv`; el.click(); URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="container max-w-5xl py-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div>
            <h1 className="text-2xl font-bold">Planned vs completed</h1>
            <p className="text-sm text-muted-foreground">Saved route plan compared with the timeslip and tracking.</p>
          </div>
          <div className="flex gap-2">
            <Input type="date" value={date} onChange={(e) => setParams({ date: e.target.value })} className="w-auto" />
            <Button variant="outline" onClick={downloadCsv} disabled={!reports.length}><Download className="h-4 w-4" /> CSV</Button>
          </div>
        </div>
        <Link to="/fleet/live" className="text-sm text-primary underline">Back to live map</Link>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && !reports.length && <p className="text-sm text-muted-foreground">No saved routes for this date.</p>}

        {reports.map(({ a, rows }) => {
          const s = summarise(rows);
          const diff = milesDifference(a.plannedRoadMiles, a.timeslipMiles ?? (a.path.length ? a.drivenMiles : null));
          return (
            <Card key={a.key} style={{ borderLeft: `4px solid ${a.colour}` }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex flex-wrap items-center gap-2">
                  <span className="font-mono">{a.registration}</span>
                  <span className="text-muted-foreground font-normal text-sm">{a.driver ?? "No driver"} · {a.name ?? "No saved route"}</span>
                  {!a.timeslipId && <Badge variant="outline">No timeslip yet</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <Stat label="Stops done" value={`${s.done}/${s.planned}`} sub={`${s.missed} missed · ${s.extra} extra`} />
                  <Stat label="Miles" value={a.plannedRoadMiles != null ? `${a.plannedRoadMiles.toFixed(0)} planned` : "—"}
                    sub={`${a.timeslipMiles != null ? `${a.timeslipMiles} on timeslip` : "no timeslip miles"}${a.path.length ? ` · ${a.drivenMiles.toFixed(0)} tracked` : ""}${diff != null ? ` (${diff > 0 ? "+" : ""}${diff})` : ""}`} />
                  <Stat label="Hours" value={a.plannedMinutes != null ? `${(a.plannedMinutes / 60).toFixed(1)} h driving planned` : "—"}
                    sub={a.timeslipHours != null ? `${Number(a.timeslipHours).toFixed(1)} h on timeslip` : "no timeslip"} />
                  <Stat label="Lateness" value={s.lateStops ? `${s.lateStops} late` : "—"} sub={s.lateStops ? `avg ${s.avgLateMinutes} min` : a.path.length ? "on time" : "needs tracking"} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2">#</th><th className="pr-2">Stop</th><th className="pr-2">Result</th><th className="pr-2">Planned</th><th className="pr-2">Actual</th><th>Diff</th></tr></thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.key + i} className="border-t">
                          <td className="py-1 pr-2">{i + 1}</td>
                          <td className="pr-2"><span className="capitalize">{r.type}</span> <span className="text-muted-foreground">{r.address}</span></td>
                          <td className="pr-2"><Badge variant={r.outcome === "done" ? "default" : r.outcome === "missed" ? "destructive" : "secondary"}>{r.outcome}</Badge></td>
                          <td className="pr-2">{r.plannedTime ?? "—"}</td>
                          <td className="pr-2">{r.actualTime ?? "—"}</td>
                          <td>{r.lateMinutes != null ? `${r.lateMinutes > 0 ? "+" : ""}${r.lateMinutes} min` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Layout>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
