import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { listVehicles } from "@/services/vehicleService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { colouredMarkerIcon } from "@/lib/mapMarkers";
import { isStale, liveStatus, matchVehicles, type LivePosition, type LiveStatus } from "@/lib/fleet/liveTracking";

const STATUS_LABEL: Record<LiveStatus, string> = { moving: "Moving", idling: "Engine on, stopped", off: "Engine off" };
const STATUS_PIN = { moving: "green", idling: "orange", off: "grey" } as const;

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (target) map.flyTo(target, 15); }, [target, map]);
  return null;
}
function FitAll({ points }: { points: [number, number][] }) {
  const map = useMap();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done && points.length) { map.fitBounds(points, { padding: [30, 30], maxZoom: 13 }); setDone(true); }
  }, [points, done, map]);
  return null;
}

export default function LiveMap() {
  const navigate = useNavigate();
  const [focus, setFocus] = useState<[number, number] | null>(null);

  const positions = useQuery({
    queryKey: ["radius-positions"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("radius-positions", { body: {} });
      if (error) {
        let msg = "Couldn't reach Radius. Try again in a minute.";
        try { const b = await (error as any).context?.json(); if (b?.message) msg = b.message; } catch { /* ignore */ }
        throw new Error(msg);
      }
      return data as { devices: LivePosition[]; fetched_at: string };
    },
    refetchInterval: 60_000,
    retry: 1,
  });
  const vehicles = useQuery({ queryKey: ["fleet-vehicles-live"], queryFn: listVehicles });
  const redIssues = useQuery({
    queryKey: ["fleet-red-issues"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("vehicle_issues").select("vehicle_id")
        .eq("severity", "high").not("status", "in", "(resolved,cancelled)");
      return new Set<string>((data ?? []).map((r: any) => r.vehicle_id));
    },
  });

  const rows = useMemo(() => {
    const matched = matchVehicles(positions.data?.devices ?? [], (vehicles.data ?? []) as any[]);
    return matched.sort((a, b) => a.position.registration.localeCompare(b.position.registration));
  }, [positions.data, vehicles.data]);
  const points = rows.map((r) => [r.position.lat, r.position.lon] as [number, number]);
  const unmatched = rows.filter((r) => !r.vehicle);

  return (
    <Layout>
      <div className="container mx-auto px-3 py-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Live map</h1>
            <p className="text-sm text-muted-foreground">
              {positions.data ? `${rows.length} vans · updated ${formatDistanceToNow(new Date(positions.data.fetched_at), { addSuffix: true })}` : "Where every van is right now"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/fleet">Fleet</Link></Button>
            <Button size="sm" onClick={() => positions.refetch()} disabled={positions.isFetching}>
              {positions.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
            </Button>
          </div>
        </div>

        {positions.error && (
          <Card className="border-destructive"><CardContent className="p-3 text-sm text-destructive">{(positions.error as Error).message}</CardContent></Card>
        )}

        <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
          <div className="h-[55vh] lg:h-[75vh] rounded-lg overflow-hidden border">
            <MapContainer center={[53.5, -2.2]} zoom={6} style={{ height: "100%", width: "100%" }}>
              <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FitAll points={points} />
              <FlyTo target={focus} />
              {rows.map(({ position: p, vehicle }) => {
                const st = liveStatus(p);
                const stale = isStale(p.timestamp);
                return (
                  <Marker key={p.id} position={[p.lat, p.lon]} icon={colouredMarkerIcon(stale ? "grey" : STATUS_PIN[st])}>
                    <Popup>
                      <div className="space-y-1 text-sm">
                        <div className="font-semibold">{p.registration}</div>
                        <div>{STATUS_LABEL[st]}{p.speed ? ` · ${p.speed} mph` : ""}</div>
                        {p.driver_name && <div>{p.driver_name}</div>}
                        <div>{[p.street, p.town, p.post_code].filter(Boolean).join(", ")}</div>
                        {p.timestamp && <div className="text-muted-foreground">{stale ? "Last seen " : "Updated "}{formatDistanceToNow(new Date(p.timestamp * 1000), { addSuffix: true })}</div>}
                        {vehicle && <button className="text-primary underline" onClick={() => navigate(`/fleet/vehicles/${vehicle.id}`)}>Open van</button>}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          <div className="space-y-2 lg:max-h-[75vh] lg:overflow-y-auto">
            {positions.isLoading && <p className="text-sm text-muted-foreground">Loading vans…</p>}
            {rows.map(({ position: p, vehicle }) => {
              const st = liveStatus(p);
              const stale = isStale(p.timestamp);
              const red = vehicle && redIssues.data?.has(vehicle.id);
              const offRoad = vehicle && (vehicle as any).status && (vehicle as any).status !== "active" && (vehicle as any).status !== "operational";
              return (
                <button key={p.id} onClick={() => setFocus([p.lat, p.lon])}
                  className={`w-full text-left rounded-md border p-2.5 hover:bg-muted ${stale ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold">{p.registration}</span>
                    <Badge variant={st === "moving" ? "default" : st === "idling" ? "secondary" : "outline"}>
                      {st === "moving" ? `${p.speed} mph` : STATUS_LABEL[st]}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.driver_name || "No driver"} · {[p.street, p.town, p.post_code].filter(Boolean).join(", ")}</div>
                  <div className="flex flex-wrap items-center gap-1 mt-1 text-xs">
                    {p.timestamp && <span className="text-muted-foreground">{stale ? "Last seen " : ""}{formatDistanceToNow(new Date(p.timestamp * 1000), { addSuffix: true })}</span>}
                    {red && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Red defect</Badge>}
                    {offRoad && <Badge variant="outline">{String((vehicle as any).status).replace(/_/g, " ")}</Badge>}
                    {!vehicle && <Badge variant="outline">Not in Fleet</Badge>}
                    {vehicle && <Link to={`/fleet/vehicles/${vehicle.id}`} onClick={(e) => e.stopPropagation()} className="ml-auto text-primary underline">Open</Link>}
                  </div>
                </button>
              );
            })}
            {unmatched.length > 0 && (
              <p className="text-xs text-muted-foreground">{unmatched.length} tracker(s) don't match a Fleet van's registration.</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
