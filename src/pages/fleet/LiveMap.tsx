import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RouteLayers, useRouteDay } from "@/components/fleet/RouteOverlay";
import { SendEtaLinkDialog } from "@/components/fleet/SendEtaLinkDialog";
import { format } from "date-fns";
import { isStale, liveStatus, matchVehicles, type LivePosition, type LiveStatus } from "@/lib/fleet/liveTracking";

const STATUS_LABEL: Record<LiveStatus, string> = { moving: "Moving", idling: "Engine on, stopped", off: "Engine off" };
const STATUS_PIN = { moving: "green", idling: "orange", off: "grey" } as const;

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (target) map.setView(target, 15); }, [target, map]);
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
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const [date, setDate] = useState(today);
  const [vanFilter, setVanFilter] = useState("all");
  const [etaReg, setEtaReg] = useState<string | null>(null);
  const isToday = date === today;
  const isMobile = useIsMobile();
  const [view, setView] = useState<"map" | "list">("map");
  const mapBoxRef = useRef<HTMLDivElement>(null);
  const [mapTop, setMapTop] = useState(0);
  useLayoutEffect(() => {
    if (!isMobile || view !== "map") return;
    const measure = () => mapBoxRef.current && setMapTop(mapBoxRef.current.getBoundingClientRect().top + window.scrollY);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isMobile, view]);
  const focusOn = (pt: [number, number]) => { setFocus([...pt] as [number, number]); if (isMobile) setView("map"); };
  const routeDay = useRouteDay(date);
  const shownRoutes = routeDay.analyses.filter((a) => vanFilter === "all" || a.registration === vanFilter);

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
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold">Live map</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {positions.data ? `${rows.length} vans · updated ${formatDistanceToNow(new Date(positions.data.fetched_at), { addSuffix: true })}` : "Where every van is right now"}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild><Link to="/fleet">Fleet</Link></Button>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-9 min-w-0 flex-1 sm:flex-none sm:w-auto" aria-label="Route date" />
            <Select value={vanFilter} onValueChange={setVanFilter}>
              <SelectTrigger className="h-9 w-28 shrink-0" aria-label="Show van"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vans</SelectItem>
                {routeDay.analyses.map((a) => <SelectItem key={a.key} value={a.registration}>{a.registration}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="shrink-0" onClick={() => positions.refetch()} disabled={positions.isFetching} aria-label="Refresh">
              {positions.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}<span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
          {isMobile && (
            <div className="grid grid-cols-2 gap-1 rounded-md border p-1" role="tablist">
              <Button size="sm" role="tab" aria-selected={view === "map"} variant={view === "map" ? "default" : "ghost"} onClick={() => setView("map")}>Map</Button>
              <Button size="sm" role="tab" aria-selected={view === "list"} variant={view === "list" ? "default" : "ghost"} onClick={() => setView("list")}>List · {shownRoutes.length + (isToday ? rows.length : 0)}</Button>
            </div>
          )}
        </div>

        {positions.error && (
          <Card className="border-destructive"><CardContent className="p-3 text-sm text-destructive">{(positions.error as Error).message}</CardContent></Card>
        )}

        <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
          {(!isMobile || view === "map") && (
          <div ref={mapBoxRef} className={`relative isolate z-0 rounded-lg overflow-hidden border ${isMobile ? "" : "h-[55vh] lg:h-[75vh]"}`}
            style={isMobile ? { height: `max(280px, calc(100dvh - ${mapTop}px - 20px))` } : undefined}>
            <MapContainer preferCanvas zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false} center={[53.5, -2.2]} zoom={6} style={{ height: "100%", width: "100%" }}>
              <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FitAll points={points} />
              <FlyTo target={focus} />
              <RouteLayers analyses={shownRoutes} />
              {isToday && rows.filter((r) => vanFilter === "all" || r.position.registration === vanFilter).map(({ position: p, vehicle }) => {
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
                        <button className="block text-primary underline" onClick={() => setEtaReg(p.registration)}>Send ETA link</button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
          )}

          {(!isMobile || view === "list") && (
          <div className="space-y-2 lg:max-h-[75vh] lg:overflow-y-auto">
            {shownRoutes.length > 0 && (
              <div className="space-y-2">
                <div>
                  <h2 className="text-sm font-semibold">Saved routes · {format(new Date(`${date}T12:00:00`), "EEE d MMM")}</h2>
                  <p className="text-xs text-muted-foreground">Planned stops vs where the van went</p>
                </div>
                {shownRoutes.map((a) => {
                  const visited = a.stops.filter((s) => s.visitedAt).length;
                  return (
                    <button key={a.key} onClick={() => a.stops[0] && focusOn([a.stops[0].lat, a.stops[0].lon])}
                      className="w-full text-left rounded-md border p-2.5 hover:bg-muted" style={{ borderLeft: `4px solid ${a.colour}` }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="font-mono font-semibold truncate">{a.timeslipId ? a.registration : `Route ${(a.name ?? "").replace(/^\d{4}-\d{2}-\d{2}\s*[—-]\s*/, "") || "—"}`}</span>
                          {!a.timeslipId && <Badge variant="outline" className="shrink-0 text-[10px]">No timeslip linked</Badge>}
                        </span>
                        <Badge className="shrink-0" variant={visited === a.stops.length ? "default" : "secondary"}>{visited}/{a.stops.length} stops</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{a.timeslipId ? `${a.driver || "No driver"}${a.name ? ` · ${a.name}` : ""}` : "Link it on a timeslip to see the van"}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.plannedRoadMiles != null ? `Planned ${a.plannedRoadMiles.toFixed(0)} mi by road (depot to depot)` : a.roadUnavailable ? "Road line unavailable — showing straight lines" : "Loading road route…"}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1 text-xs">
                        {a.path.length === 0 ? <span className="text-muted-foreground">Not tracked yet</span> : (
                          <>
                            <span className="text-muted-foreground">Driven {a.drivenMiles.toFixed(0)} mi</span>
                            {a.stretches.length > 0
                              ? <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{a.stretches.length} off-route ({a.stretches.map((s) => `${format(new Date(s.start), "HH:mm")}–${format(new Date(s.end), "HH:mm")}`).join(", ")})</Badge>
                              : <Badge variant="outline">On route</Badge>}
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
                <Link to={`/fleet/route-report?date=${date}`} className="block text-sm text-primary underline">Planned vs completed report</Link>
              </div>
            )}
            {!routeDay.isLoading && routeDay.analyses.length === 0 && <p className="text-xs text-muted-foreground">No saved routes for this date.</p>}
            {isToday && <h2 className="text-sm font-semibold pt-2">Live vans</h2>}
            {!isToday && <p className="text-xs text-muted-foreground">Live pins are hidden for past dates.</p>}
            {positions.isLoading && <p className="text-sm text-muted-foreground">Loading vans…</p>}
            {isToday && rows.filter((r) => vanFilter === "all" || r.position.registration === vanFilter).map(({ position: p, vehicle }) => {
              const st = liveStatus(p);
              const stale = isStale(p.timestamp);
              const red = vehicle && redIssues.data?.has(vehicle.id);
              const offRoad = vehicle && (vehicle as any).status && (vehicle as any).status !== "active" && (vehicle as any).status !== "operational";
              return (
                <button key={p.id} onClick={() => focusOn([p.lat, p.lon])}
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
                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setEtaReg(p.registration); }} className="ml-auto text-primary underline">Send ETA link</span>
                    {vehicle && <Link to={`/fleet/vehicles/${vehicle.id}`} onClick={(e) => e.stopPropagation()} className="text-primary underline">Open</Link>}
                  </div>
                </button>
              );
            })}
            {unmatched.length > 0 && (
              <p className="text-xs text-muted-foreground">{unmatched.length} tracker(s) don't match a Fleet van's registration.</p>
            )}
          </div>
          )}
        </div>
      </div>
      <SendEtaLinkDialog registration={etaReg} onClose={() => setEtaReg(null)} />
    </Layout>
  );
}
