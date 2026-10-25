import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Polyline, CircleMarker, Popup } from "react-leaflet";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { normaliseReg } from "@/lib/fleet/liveTracking";
import { firstVisit, offRouteStretches, pathMiles, type Sample, type OffRouteStretch } from "@/lib/fleet/routeDeviation";

/** Read a semantic token as a usable colour string (Leaflet needs literal colours). */
export function tokenColour(name: string): string {
  if (typeof window === "undefined") return "gray";
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `hsl(${v})` : "gray";
}
const ROUTE_TOKENS = ["--segment-1", "--segment-2", "--segment-3", "--segment-4", "--status-transit", "--status-trunk", "--status-booked", "--status-ni"];

export interface RouteStop { lat: number; lon: number; type: string; postcode?: string; visitedAt: number | null }
export interface RouteAnalysis {
  key: string; registration: string; driver: string | null; colour: string;
  stops: RouteStop[]; path: Sample[]; stretches: OffRouteStretch[];
  plannedMiles: number | null; drivenMiles: number;
}

export function useRouteDay(date: string) {
  const routes = useQuery({
    queryKey: ["fleet-route-day", date],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("fleet_route_day", { p_date: date });
      if (error) throw error;
      return (data ?? []) as { timeslip_id: string; registration: string | null; driver_name: string | null; job_locations: any[]; mileage: number | null }[];
    },
  });
  const history = useQuery({
    queryKey: ["fleet-position-history", date],
    queryFn: async () => {
      const start = new Date(`${date}T00:00:00`); const end = new Date(start.getTime() + 86400_000);
      const out: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase as any).from("fleet_position_history")
          .select("registration, lat, lon, recorded_at").gte("recorded_at", start.toISOString()).lt("recorded_at", end.toISOString())
          .order("recorded_at").range(from, from + 999);
        if (error) throw error;
        out.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
    refetchInterval: 120_000,
  });

  const analyses = useMemo<RouteAnalysis[]>(() => {
    const byReg = new Map<string, Sample[]>();
    for (const h of history.data ?? []) {
      const r = normaliseReg(h.registration);
      if (!byReg.has(r)) byReg.set(r, []);
      byReg.get(r)!.push({ lat: h.lat, lon: h.lon, t: new Date(h.recorded_at).getTime() });
    }
    return (routes.data ?? []).filter((r) => Array.isArray(r.job_locations) && r.job_locations.length).map((r, i) => {
      const reg = normaliseReg(r.registration);
      const path = byReg.get(reg) ?? [];
      const plan = r.job_locations.filter((j: any) => j?.lat != null && j?.lng != null).map((j: any) => ({ lat: Number(j.lat), lon: Number(j.lng), type: j.type, postcode: j.postcode }));
      return {
        key: r.timeslip_id, registration: reg || "No van", driver: r.driver_name,
        colour: tokenColour(ROUTE_TOKENS[i % ROUTE_TOKENS.length]),
        stops: plan.map((s) => ({ ...s, visitedAt: firstVisit(s, path) })),
        path, stretches: path.length ? offRouteStretches(path, plan) : [],
        plannedMiles: r.mileage, drivenMiles: pathMiles(path),
      };
    });
  }, [routes.data, history.data]);

  return { analyses, isLoading: routes.isLoading || history.isLoading, error: routes.error || history.error };
}

export function RouteLayers({ analyses }: { analyses: RouteAnalysis[] }) {
  const done = tokenColour("--status-done"), failed = tokenColour("--status-failed");
  return (
    <>
      {analyses.map((a) => (
        <span key={a.key}>
          <Polyline positions={a.stops.map((s) => [s.lat, s.lon])} pathOptions={{ color: a.colour, weight: 3, dashArray: "6 6", opacity: 0.8 }} />
          {a.path.length > 1 && <Polyline positions={a.path.map((s) => [s.lat, s.lon])} pathOptions={{ color: a.colour, weight: 4, opacity: 0.9 }} />}
          {a.stretches.map((st, i) => (
            <Polyline key={i} positions={a.path.filter((p) => p.t >= st.start && p.t <= st.end).map((p) => [p.lat, p.lon])}
              pathOptions={{ color: failed, weight: 7, opacity: 0.6 }} />
          ))}
          {a.stops.map((s, i) => (
            <CircleMarker key={i} center={[s.lat, s.lon]} radius={8}
              pathOptions={{ color: a.colour, weight: 2, fillColor: s.visitedAt ? done : failed, fillOpacity: 0.9 }}>
              <Popup>
                <div className="text-sm space-y-0.5">
                  <div className="font-semibold">{a.registration} · stop {i + 1}</div>
                  <div className="capitalize">{s.type}{s.postcode ? ` · ${s.postcode}` : ""}</div>
                  <div>{s.visitedAt ? `Reached ${format(new Date(s.visitedAt), "HH:mm")}` : "Not reached"}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </span>
      ))}
    </>
  );
}
