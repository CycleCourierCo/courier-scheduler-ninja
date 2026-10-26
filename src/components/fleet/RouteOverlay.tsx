import { Fragment, useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { format } from "date-fns";
import * as Sentry from "@sentry/react";
import { supabase } from "@/integrations/supabase/client";
import { normaliseReg } from "@/lib/fleet/liveTracking";
import { firstVisit, offRouteStretches, pathMiles, type Pt, type Sample, type OffRouteStretch } from "@/lib/fleet/routeDeviation";
import { DEPOT_LOCATION } from "@/constants/depot";
import { decodePolyline } from "@/services/routeGenerationService";
import { stopCompletion } from "../../../supabase/functions/_shared/stopEta";
import { routeDepotIcon } from "@/components/scheduling/RouteMapPrimitives";

/** Read a semantic token as a usable colour string (Leaflet needs literal colours). */
export function tokenColour(name: string): string {
  if (typeof window === "undefined") return "gray";
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `hsl(${v})` : "gray";
}
const ROUTE_TOKENS = ["--segment-1", "--segment-2", "--segment-3", "--segment-4", "--status-transit", "--status-trunk", "--status-booked", "--status-ni"];
const DEPOT: Pt = { lat: DEPOT_LOCATION.lat, lon: DEPOT_LOCATION.lon };
const MAX_STOPS_PER_REQUEST = 25;
export interface StopEtaView { minutes: number; miles: number; eta: string; stopsBefore: number }

export interface RouteStop { lat: number; lon: number; type: string; orderId?: string; address?: string; estimatedTime?: string; visitedAt: number | null; trackingNumber?: string | null; completed?: "Collected" | "Delivered" | null }
export interface RouteAnalysis {
  key: string; timeslipId: string | null; savedRouteId: string | null; vehicleId: string | null; name: string | null; registration: string; driver: string | null; colour: string;
  stops: RouteStop[]; path: Sample[]; stretches: OffRouteStretch[];
  roadLine: Pt[] | null; roadUnavailable: boolean; plannedRoadMiles: number | null; plannedMinutes: number | null;
  timeslipMiles: number | null; drivenMiles: number;
  startTime: string | null; doneStops: any[] | null; timeslipHours: number | null;
}

interface DayRow {
  timeslip_id: string | null; saved_route_id: string | null; route_name: string | null; start_time: string | null;
  planned_stops: any[] | null; vehicle_id: string | null; registration: string | null; driver_name: string | null;
  job_locations: any[] | null; mileage: number | null; total_hours: number | null;
}

/** Planned stops: the saved route if linked, otherwise the timeslip's own stops. */
function plannedStops(r: DayRow) {
  if (Array.isArray(r.planned_stops) && r.planned_stops.length) {
    return r.planned_stops.filter((s) => s?.lat != null && s?.lon != null)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((s) => ({ lat: Number(s.lat), lon: Number(s.lon), type: s.type, orderId: s.orderId, address: s.address, estimatedTime: s.estimatedTime }));
  }
  return (r.job_locations ?? []).filter((j) => j?.lat != null && j?.lng != null)
    .map((j) => ({ lat: Number(j.lat), lon: Number(j.lng), type: j.type, orderId: j.order_id, address: j.postcode }));
}

/** Road route depot → stops → depot via Google (chunked), cached for the day. */
export async function fetchRoadLine(stops: Pt[]) {
  const line: Pt[] = []; let distance = 0, duration = 0;
  let origin = DEPOT;
  for (let i = 0; i < stops.length; i += MAX_STOPS_PER_REQUEST) {
    const batch = stops.slice(i, i + MAX_STOPS_PER_REQUEST);
    const last = i + MAX_STOPS_PER_REQUEST >= stops.length;
    const destination = last ? DEPOT : batch[batch.length - 1];
    const mids = last ? batch : batch.slice(0, -1);
    const { data, error } = await supabase.functions.invoke("route-path", { body: { origin, stops: mids, destination } });
    if (error || typeof data?.encodedPolyline !== "string") throw error ?? new Error("No route returned");
    line.push(...decodePolyline(data.encodedPolyline).map(([lat, lon]) => ({ lat, lon })));
    distance += data.distance_m ?? 0; duration += data.duration_s ?? 0;
    origin = destination;
  }
  return { line, miles: distance / 1609.344, minutes: Math.round(duration / 60) };
}

function stopIcon(n: number, ring: string, fill: string, done: boolean) {
  return L.divIcon({
    className: "",
    iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12],
    html: `<div style="width:24px;height:24px;border-radius:9999px;border:2px solid ${ring};background:${fill};color:${tokenColour("--primary-foreground")};font:700 11px/20px Overpass,sans-serif;text-align:center">${done ? "&#10003;" : n}</div>`,
  });
}

export function useRouteDay(date: string) {
  const routes = useQuery({
    queryKey: ["fleet-route-day", date],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("fleet_route_day", { p_date: date });
      if (error) throw error;
      return (data ?? []) as DayRow[];
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

  const planned = useMemo(() => (routes.data ?? []).map((r) => ({ row: r, stops: plannedStops(r) })).filter((p) => p.stops.length), [routes.data]);

  const roads = useQueries({
    queries: planned.map((p) => ({
      queryKey: ["fleet-road-line", p.stops.map((s) => `${s.lat.toFixed(5)},${s.lon.toFixed(5)}`).join("|")],
      queryFn: () => fetchRoadLine(p.stops).catch((e) => { Sentry.captureException(e, { tags: { feature: "live-map-road-line" } }); throw e; }),
      staleTime: 86400_000, gcTime: 86400_000, retry: 1,
    })),
  });

  const orderIds = useMemo(() => [...new Set(planned.flatMap((p) => p.stops.map((s) => s.orderId).filter(Boolean)))] as string[], [planned]);
  const orders = useQuery({
    queryKey: ["fleet-route-orders", orderIds.join(",")],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const out = new Map<string, { tracking_number: string | null; order_collected: boolean | null; order_delivered: boolean | null }>();
      for (let i = 0; i < orderIds.length; i += 200) {
        const { data, error } = await supabase.from("orders").select("id, tracking_number, order_collected, order_delivered").in("id", orderIds.slice(i, i + 200));
        if (error) throw error;
        for (const o of data ?? []) out.set(o.id, o);
      }
      return out;
    },
    refetchInterval: 120_000,
  });

  const roadsKey = roads.map((q) => `${q.status}:${q.dataUpdatedAt}`).join("|");
  const analyses = useMemo<RouteAnalysis[]>(() => {
    const byReg = new Map<string, Sample[]>();
    for (const h of history.data ?? []) {
      const r = normaliseReg(h.registration);
      if (!byReg.has(r)) byReg.set(r, []);
      byReg.get(r)!.push({ lat: h.lat, lon: h.lon, t: new Date(h.recorded_at).getTime() });
    }
    return planned.map(({ row: r, stops }, i) => {
      const reg = normaliseReg(r.registration);
      const path = reg ? byReg.get(reg) ?? [] : [];
      const road = roads[i]?.data ?? null;
      const against = road?.line?.length ? road.line : [DEPOT, ...stops, DEPOT];
      return {
        key: r.timeslip_id ?? r.saved_route_id ?? String(i), timeslipId: r.timeslip_id, savedRouteId: r.saved_route_id, vehicleId: r.vehicle_id, name: r.route_name,
        registration: reg || (r.timeslip_id ? "No van" : "No timeslip yet"), driver: r.driver_name,
        colour: tokenColour(ROUTE_TOKENS[i % ROUTE_TOKENS.length]),
        stops: stops.map((s) => {
          const o = s.orderId ? orders.data?.get(s.orderId) : undefined;
          return { ...s, visitedAt: firstVisit(s, path), trackingNumber: o?.tracking_number ?? null, completed: stopCompletion(s.type, o) };
        }),
        path, stretches: path.length ? offRouteStretches(path, against) : [],
        roadLine: road?.line ?? null, roadUnavailable: !!roads[i]?.isError,
        plannedRoadMiles: road ? road.miles : null, plannedMinutes: road ? road.minutes : null,
        timeslipMiles: r.mileage, drivenMiles: pathMiles(path),
        startTime: r.start_time, doneStops: r.timeslip_id ? r.job_locations ?? [] : null, timeslipHours: r.total_hours,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planned, roadsKey, history.data, orders.data]);

  return { analyses, isLoading: routes.isLoading || history.isLoading, error: routes.error || history.error };
}

export function RouteLayers({ analyses, etas }: { analyses: RouteAnalysis[]; etas?: Map<string, Map<number, StopEtaView>> }) {
  const done = tokenColour("--status-done"), failed = tokenColour("--status-failed");
  return (
    <>
      {analyses.length > 0 && (
        <Marker position={[DEPOT.lat, DEPOT.lon]} icon={routeDepotIcon}>
          <Popup><div className="text-sm"><div className="font-semibold">Depot</div><div>{DEPOT_LOCATION.address}</div></div></Popup>
        </Marker>
      )}
      {analyses.map((a) => {
        const planned = a.roadLine ?? [DEPOT, ...a.stops, DEPOT];
        return (
          <Fragment key={a.key}>
            <Polyline positions={planned.map((s) => [s.lat, s.lon])}
              pathOptions={{ color: a.colour, weight: 3, dashArray: a.roadLine ? "8 6" : "2 8", opacity: 0.8 }} />
            {a.path.length > 1 && <Polyline positions={a.path.map((s) => [s.lat, s.lon])} pathOptions={{ color: a.colour, weight: 4, opacity: 0.9 }} />}
            {a.stretches.map((st, i) => (
              <Polyline key={i} positions={a.path.filter((p) => p.t >= st.start && p.t <= st.end).map((p) => [p.lat, p.lon])}
                pathOptions={{ color: failed, weight: 7, opacity: 0.6 }} />
            ))}
            {a.stops.map((s, i) => (
              <Marker key={i} position={[s.lat, s.lon]}
                icon={stopIcon(i + 1, a.colour, s.completed || s.visitedAt ? done : a.path.length ? failed : a.colour, !!s.completed)}>
                <Popup>
                  <div className="text-sm space-y-0.5">
                    <div className="font-semibold">{a.registration} · stop {i + 1}</div>
                    {s.trackingNumber && <div className="font-mono">{s.trackingNumber}</div>}
                    <div className="capitalize">{s.type}{s.estimatedTime ? ` · planned ${s.estimatedTime}` : ""}</div>
                    {s.address && <div>{s.address}</div>}
                    <div>{s.completed ? `✓ ${s.completed}` : s.visitedAt ? `Reached ${format(new Date(s.visitedAt), "HH:mm")}` : etas?.get(a.key)?.get(i) ? `ETA ${format(new Date(etas.get(a.key)!.get(i)!.eta), "HH:mm")} · ${etas.get(a.key)!.get(i)!.miles} mi` : a.path.length ? "Not reached" : "No tracking yet"}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}
