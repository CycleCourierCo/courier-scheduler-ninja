import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Loader2, Wand2, Trash2, Save, MapPin, SquareDashed } from "lucide-react";

import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { getOrders } from "@/services/fetchOrderService";
import type { Order } from "@/types/order";
import { DEPOT_LOCATION } from "@/constants/depot";

const ROUTE_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f97316", "#ec4899", "#a855f7"];
const fmtDuration = (min: number | null | undefined) => {
  if (min == null || !Number.isFinite(Number(min))) return "—";
  const total = Number(min);
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

type Pin = {
  key: string;
  orderId: string;
  type: "pickup" | "delivery";
  lat: number;
  lon: number;
  label: string;
  address: string;
};

function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

type LegStats = { totalCandidates: number; missingCoords: number; alreadyAssigned: number; completed: number };

function dateStr(v: any): string | null {
  if (!v) return null;
  try { return format(new Date(v), "yyyy-MM-dd"); } catch { return null; }
}

function arrIncludes(arr: any, target: string): boolean {
  if (!Array.isArray(arr)) return false;
  for (const v of arr) {
    if (typeof v === "string" && v.startsWith(target)) return true;
    const s = dateStr(v);
    if (s === target) return true;
  }
  return false;
}

function pickPins(orders: Order[], assignedKeys: Set<string>, routeDate: string): { pins: Pin[]; stats: LegStats } {
  const pins: Pin[] = [];
  const stats: LegStats = { totalCandidates: 0, missingCoords: 0, alreadyAssigned: 0, completed: 0 };
  for (const o of orders) {
    const oAny: any = o as any;
    const senderAny: any = oAny.sender ?? {};
    const receiverAny: any = oAny.receiver ?? {};
    const sAddr = senderAny.address ?? {};
    const rAddr = receiverAny.address ?? {};
    const sLat = num(sAddr.lat ?? sAddr.latitude ?? senderAny.lat);
    const sLon = num(sAddr.lon ?? sAddr.lng ?? sAddr.longitude ?? senderAny.lon);
    const rLat = num(rAddr.lat ?? rAddr.latitude ?? receiverAny.lat);
    const rLon = num(rAddr.lon ?? rAddr.lng ?? rAddr.longitude ?? receiverAny.lon);
    const tn = o.trackingNumber || o.id.slice(0, 6);
    const collected = oAny.order_collected ?? oAny.orderCollected ?? false;
    const delivered = oAny.order_delivered ?? oAny.orderDelivered ?? false;

    const schedPickup = dateStr(oAny.scheduled_pickup_date ?? o.scheduledPickupDate);
    const schedDelivery = dateStr(oAny.scheduled_delivery_date ?? o.scheduledDeliveryDate);
    const pickupAvail = oAny.pickup_date ?? o.pickupDate;
    const deliveryAvail = oAny.delivery_date ?? o.deliveryDate;

    const pickupMatches =
      schedPickup === routeDate ||
      (!schedPickup && arrIncludes(pickupAvail, routeDate));
    const deliveryMatches =
      schedDelivery === routeDate ||
      (!schedDelivery && arrIncludes(deliveryAvail, routeDate));

    if (pickupMatches) {
      stats.totalCandidates++;
      if (collected) {
        stats.completed++;
      } else if (sLat === null || sLon === null) {
        stats.missingCoords++;
      } else {
        const key = `${o.id}:pickup`;
        if (assignedKeys.has(key)) stats.alreadyAssigned++;
        else pins.push({
          key, orderId: o.id, type: "pickup", lat: sLat, lon: sLon,
          label: `${tn} · Pick-up · ${senderAny.name ?? ""}`,
          address: [sAddr.street, sAddr.city, sAddr.zipCode ?? sAddr.postal_code].filter(Boolean).join(", "),
        });
      }
    }
    if (deliveryMatches) {
      stats.totalCandidates++;
      if (delivered) {
        stats.completed++;
      } else if (rLat === null || rLon === null) {
        stats.missingCoords++;
      } else {
        const key = `${o.id}:delivery`;
        if (assignedKeys.has(key)) stats.alreadyAssigned++;
        else pins.push({
          key, orderId: o.id, type: "delivery", lat: rLat, lon: rLon,
          label: `${tn} · Delivery · ${receiverAny.name ?? ""}`,
          address: [rAddr.street, rAddr.city, rAddr.zipCode ?? rAddr.postal_code].filter(Boolean).join(", "),
        });
      }
    }
  }
  return { pins, stats };
}

const UK_CENTER = { lat: 52.5, lng: -1.5 };

export default function DispatchRoutesPage() {
  const qc = useQueryClient();
  const { ready, error: mapsError } = useGoogleMaps(["geometry"]);

  const [routeDate, setRouteDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [routeName, setRouteName] = useState<string>("Route 1");
  const [selected, setSelected] = useState<Record<string, true>>({});
  const [addMode, setAddMode] = useState<"replace" | "add">("replace");
  const addModeRef = useRef(addMode);
  useEffect(() => { addModeRef.current = addMode; }, [addMode]);

  const [boxSelectMode, setBoxSelectMode] = useState(false);
  const boxSelectModeRef = useRef(false);
  useEffect(() => { boxSelectModeRef.current = boxSelectMode; }, [boxSelectMode]);

  const [driverId, setDriverId] = useState<string>("");
  const [targetRouteId, setTargetRouteId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [optimising, setOptimising] = useState(false);
  const [sequence, setSequence] = useState<string[] | null>(null);
  const [totals, setTotals] = useState<{ km: number; min: number } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const polylineRef = useRef<any>(null);
  const projectionOverlayRef = useRef<any>(null);
  const routePolylinesRef = useRef<Record<string, any>>({});
  const depotMarkerRef = useRef<any>(null);
  const [hiddenRoutes, setHiddenRoutes] = useState<Record<string, true>>({});

  const ordersQuery = useQuery({ queryKey: ["dispatch-orders-all"], queryFn: getOrders });

  const drivers = useQuery({
    queryKey: ["dispatch-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles").select("id, name, email")
        .eq("role", "driver" as any).eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const existingStops = useQuery({
    queryKey: ["dispatch-existing-stops", routeDate],
    queryFn: async () => {
      const sb = supabase as any;
      const { data: routes } = await sb.from("dispatch_routes").select("id").eq("route_date", routeDate);
      const ids = (routes ?? []).map((r: any) => r.id);
      if (ids.length === 0) return [] as any[];
      const { data } = await sb.from("dispatch_route_stops").select("order_id, stop_type, route_id").in("route_id", ids);
      return (data ?? []) as any[];
    },
  });

  const routesForDate = useQuery({
    queryKey: ["dispatch-routes-for-date", routeDate],
    queryFn: async () => {
      const sb = supabase as any;
      const { data: routes } = await sb.from("dispatch_routes")
        .select("id, name, driver_id, status, total_distance_km, total_duration_min")
        .eq("route_date", routeDate)
        .order("created_at", { ascending: true });
      const list = (routes ?? []) as any[];
      if (list.length === 0) return list;
      const ids = list.map((r) => r.id);
      const { data: stops } = await sb.from("dispatch_route_stops")
        .select("route_id, order_id, stop_type, sequence, address, lat, lon")
        .in("route_id", ids)
        .order("sequence", { ascending: true });
      const byRoute: Record<string, any[]> = {};
      for (const s of (stops ?? [])) {
        (byRoute[s.route_id] ||= []).push(s);
      }
      return list.map((r) => ({ ...r, stops: byRoute[r.id] ?? [] }));
    },
  });


  const assignedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const r of existingStops.data ?? []) s.add(`${r.order_id}:${r.stop_type}`);
    return s;
  }, [existingStops.data]);

  const { pins, stats } = useMemo(
    () => pickPins(ordersQuery.data ?? [], assignedKeys, routeDate),
    [ordersQuery.data, assignedKeys, routeDate]
  );
  const pinsByKey = useMemo(() => Object.fromEntries(pins.map((p) => [p.key, p])), [pins]);

  // Init map
  useEffect(() => {
    if (!ready || !mapDivRef.current || mapRef.current) return;
    const g = (window as any).google;
    if (!g?.maps) return;
    const map = new g.maps.Map(mapDivRef.current, {
      center: UK_CENTER, zoom: 6,
      mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      gestureHandling: "greedy", clickableIcons: false,
    });
    mapRef.current = map;

    // OverlayView for pixel projection (used by box-select)
    const overlay = new g.maps.OverlayView();
    overlay.onAdd = () => {};
    overlay.draw = () => {};
    overlay.onRemove = () => {};
    overlay.setMap(map);
    projectionOverlayRef.current = overlay;
  }, [ready]);

  // DOM-level shift/box drag selection on the map container
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || !ready) return;

    let startX = 0, startY = 0;
    let rectEl: HTMLDivElement | null = null;
    let dragging = false;

    const onMouseDown = (e: MouseEvent) => {
      const useBox = e.shiftKey || boxSelectModeRef.current;
      if (!useBox) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = container.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      dragging = true;
      rectEl = document.createElement("div");
      rectEl.style.position = "absolute";
      rectEl.style.left = `${startX}px`;
      rectEl.style.top = `${startY}px`;
      rectEl.style.width = "0px";
      rectEl.style.height = "0px";
      rectEl.style.border = "2px solid #6366f1";
      rectEl.style.background = "rgba(99,102,241,0.12)";
      rectEl.style.pointerEvents = "none";
      rectEl.style.zIndex = "1000";
      container.appendChild(rectEl);
      // disable map drag during selection
      mapRef.current?.setOptions({ draggable: false });
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging || !rectEl) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const left = Math.min(startX, x);
      const top = Math.min(startY, y);
      const w = Math.abs(x - startX);
      const h = Math.abs(y - startY);
      rectEl.style.left = `${left}px`;
      rectEl.style.top = `${top}px`;
      rectEl.style.width = `${w}px`;
      rectEl.style.height = `${h}px`;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (!dragging) return;
      dragging = false;
      const rect = container.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;
      const x1 = Math.min(startX, endX), x2 = Math.max(startX, endX);
      const y1 = Math.min(startY, endY), y2 = Math.max(startY, endY);
      if (rectEl) { rectEl.remove(); rectEl = null; }
      mapRef.current?.setOptions({ draggable: true });

      const overlay = projectionOverlayRef.current;
      const proj = overlay?.getProjection?.();
      if (!proj) return;
      const hits: string[] = [];
      for (const key in markersRef.current) {
        const m = markersRef.current[key];
        const pt = proj.fromLatLngToContainerPixel(m.getPosition());
        if (pt && pt.x >= x1 && pt.x <= x2 && pt.y >= y1 && pt.y <= y2) hits.push(key);
      }
      if (hits.length === 0 && Math.abs(endX - startX) < 4 && Math.abs(endY - startY) < 4) {
        // it was a tiny click, not a drag — ignore
        return;
      }
      setSelected((prev) => {
        const base = addModeRef.current === "add" ? { ...prev } : {};
        for (const h of hits) base[h] = true;
        return base;
      });
      setBoxSelectMode(false);
    };

    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [ready]);

  // Render markers + fit bounds
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = (window as any).google;
    for (const k of Object.keys(markersRef.current)) {
      if (!pinsByKey[k]) { markersRef.current[k].setMap(null); delete markersRef.current[k]; }
    }
    const bounds = new g.maps.LatLngBounds();
    let hasAny = false;
    for (const p of pins) {
      hasAny = true;
      const sel = !!selected[p.key];
      const color = p.type === "pickup" ? "#2563eb" : "#16a34a";
      const existing = markersRef.current[p.key];
      const pos = { lat: p.lat, lng: p.lon };
      const icon = {
        path: g.maps.SymbolPath.CIRCLE,
        fillColor: sel ? "#f59e0b" : color,
        fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, scale: sel ? 9 : 7,
      };
      if (existing) {
        existing.setPosition(pos);
        existing.setIcon(icon);
      } else {
        const m = new g.maps.Marker({ map: mapRef.current, position: pos, title: p.label, icon });
        m.addListener("click", () => {
          setSelected((prev) => {
            const next = { ...prev };
            if (next[p.key]) delete next[p.key]; else next[p.key] = true;
            return next;
          });
        });
        markersRef.current[p.key] = m;
      }
      bounds.extend(pos);
    }
    if (hasAny) mapRef.current.fitBounds(bounds, 60);
  }, [pins, selected, ready, pinsByKey]);

  // Polyline for optimised sequence
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = (window as any).google;
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    if (!sequence || sequence.length < 2) return;
    const path = sequence.map((k) => {
      const p = pinsByKey[k]; return p ? { lat: p.lat, lng: p.lon } : null;
    }).filter(Boolean) as any[];
    polylineRef.current = new g.maps.Polyline({
      map: mapRef.current, path, geodesic: true, strokeColor: "#6366f1", strokeOpacity: 0.9, strokeWeight: 4,
    });
  }, [sequence, ready, pinsByKey]);

  // Saved routes polylines (depot -> stops -> depot)
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = (window as any).google;
    const routes = routesForDate.data ?? [];
    const visibleIds = new Set(routes.filter((r: any) => !hiddenRoutes[r.id]).map((r: any) => r.id));

    // Remove stale
    for (const id of Object.keys(routePolylinesRef.current)) {
      if (!visibleIds.has(id)) {
        routePolylinesRef.current[id].setMap(null);
        delete routePolylinesRef.current[id];
      }
    }

    let anyVisible = false;
    routes.forEach((r: any, idx: number) => {
      if (!visibleIds.has(r.id)) return;
      const stops = (r.stops ?? []).filter((s: any) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lon)));
      if (stops.length === 0) return;
      anyVisible = true;
      const depot = { lat: DEPOT_LOCATION.lat, lng: DEPOT_LOCATION.lon };
      const path = [depot, ...stops.map((s: any) => ({ lat: Number(s.lat), lng: Number(s.lon) })), depot];
      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
      if (routePolylinesRef.current[r.id]) {
        routePolylinesRef.current[r.id].setOptions({ path, strokeColor: color });
      } else {
        routePolylinesRef.current[r.id] = new g.maps.Polyline({
          map: mapRef.current, path, geodesic: true, strokeColor: color, strokeOpacity: 0.85, strokeWeight: 4,
        });
      }
    });

    // Depot marker
    if (anyVisible) {
      if (!depotMarkerRef.current) {
        depotMarkerRef.current = new g.maps.Marker({
          map: mapRef.current,
          position: { lat: DEPOT_LOCATION.lat, lng: DEPOT_LOCATION.lon },
          title: "Depot · B10 0AD",
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            fillColor: "#111827", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, scale: 10,
          },
          zIndex: 9999,
        });
      }
    } else if (depotMarkerRef.current) {
      depotMarkerRef.current.setMap(null);
      depotMarkerRef.current = null;
    }
  }, [routesForDate.data, hiddenRoutes, ready]);



  const selectedPins = pins.filter((p) => selected[p.key]);

  const handleOptimise = async () => {
    if (selectedPins.length < 2) { toast({ title: "Select at least 2 stops", variant: "destructive" }); return; }
    setOptimising(true);
    try {
      const { data, error } = await supabase.functions.invoke("optimise-route", {
        body: {
          origin: { lat: DEPOT_LOCATION.lat, lon: DEPOT_LOCATION.lon },
          stops: selectedPins.map((p) => ({ id: p.key, lat: p.lat, lon: p.lon })),
        },
      });
      if (error) throw error;
      const seq: { stop_id: string; sequence: number }[] = data.sequence ?? [];
      setSequence(seq.map((s) => s.stop_id));
      setTotals({ km: data.total_distance_km, min: data.total_duration_min });
      toast({ title: "Route optimised", description: `${seq.length} stops · ${data.total_distance_km?.toFixed(1)} km · ${Math.round(data.total_duration_min)} min` });
    } catch (e: any) {
      toast({ title: "Optimise failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setOptimising(false); }
  };

  const handleSave = async () => {
    if (selectedPins.length < 1) { toast({ title: "Select at least 1 stop", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const seq = sequence ?? selectedPins.map((p) => p.key);
      const { data: route, error: rErr } = await supabase
        .from("dispatch_routes" as any)
        .insert({
          name: routeName || `Route ${routeDate}`, route_date: routeDate,
          driver_id: driverId || null, status: driverId ? "assigned" : "draft",
          total_distance_km: totals?.km ?? null, total_duration_min: totals?.min ?? null,
          optimised_at: totals ? new Date().toISOString() : null, created_by: user.user?.id ?? null,
        }).select("id").single();
      if (rErr) throw rErr;
      const stopsPayload = seq.map((key, i) => {
        const p = pinsByKey[key];
        return {
          route_id: (route as any).id, order_id: p.orderId, stop_type: p.type,
          sequence: i + 1, address: p.address, lat: p.lat, lon: p.lon,
        };
      });
      const { error: sErr } = await supabase.from("dispatch_route_stops" as any).insert(stopsPayload);
      if (sErr) throw sErr;
      toast({ title: "Route saved", description: `${seq.length} stops` });
      setSelected({}); setSequence(null); setTotals(null);
      qc.invalidateQueries({ queryKey: ["dispatch-existing-stops", routeDate] });
      qc.invalidateQueries({ queryKey: ["dispatch-routes-for-date", routeDate] });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleAddToExisting = async () => {
    if (!targetRouteId) { toast({ title: "Pick a route to add to", variant: "destructive" }); return; }
    if (selectedPins.length < 1) { toast({ title: "Select at least 1 stop", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const sb = supabase as any;
      const { data: existing } = await sb
        .from("dispatch_route_stops")
        .select("sequence")
        .eq("route_id", targetRouteId)
        .order("sequence", { ascending: false })
        .limit(1);
      const start = ((existing?.[0]?.sequence as number) ?? 0) + 1;
      const seq = sequence ?? selectedPins.map((p) => p.key);
      const payload = seq.map((key, i) => {
        const p = pinsByKey[key];
        return {
          route_id: targetRouteId, order_id: p.orderId, stop_type: p.type,
          sequence: start + i, address: p.address, lat: p.lat, lon: p.lon,
        };
      });
      const { error } = await sb.from("dispatch_route_stops").insert(payload);
      if (error) throw error;
      toast({ title: "Added to route", description: `${payload.length} stops appended` });
      setSelected({}); setSequence(null); setTotals(null);
      qc.invalidateQueries({ queryKey: ["dispatch-existing-stops", routeDate] });
    } catch (e: any) {
      toast({ title: "Add failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Layout>
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={routeDate} onChange={(e) => setRouteDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Route name</Label>
            <Input value={routeName} onChange={(e) => setRouteName(e.target.value)} className="w-48" />
          </div>
          <div>
            <Label className="text-xs">Driver</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                {(drivers.data ?? []).map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.name ?? d.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 ml-auto items-end">
            <Link to="/dispatch/orders"><Button variant="outline">Orders</Button></Link>
            <Button onClick={handleOptimise} disabled={optimising || selectedPins.length < 2} variant="outline">
              {optimising ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
              Optimise
            </Button>
            <Button onClick={handleSave} disabled={saving || selectedPins.length < 1} variant="default">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Create route
            </Button>
            <div className="flex items-end gap-1">
              <Select value={targetRouteId} onValueChange={setTargetRouteId}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Existing route…" /></SelectTrigger>
                <SelectContent>
                  {(routesForDate.data ?? []).length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground">No routes for {routeDate}</div>
                  )}
                  {(routesForDate.data ?? []).map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAddToExisting} disabled={saving || !targetRouteId || selectedPins.length < 1} variant="secondary">
                Add to route
              </Button>
            </div>
          </div>
        </div>

        {mapsError && (
          <Card className="p-3 text-sm text-destructive">Google Maps failed to load: {mapsError.message}</Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
          <Card className="p-3 flex flex-col gap-3 h-[calc(100vh-220px)]">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">Stops on {routeDate}</div>
              <Badge variant="secondary">{pins.length} unassigned</Badge>
            </div>

            <div className="text-[11px] text-muted-foreground leading-snug">
              {stats.totalCandidates === 0
                ? "No pickups or deliveries match this date (checked scheduled dates and sender/receiver availability)."
                : (
                  <>
                    {stats.totalCandidates} leg{stats.totalCandidates === 1 ? "" : "s"} match this date.
                    {stats.alreadyAssigned > 0 && <> {stats.alreadyAssigned} already on a route.</>}
                    {stats.completed > 0 && <> {stats.completed} already completed.</>}
                    {stats.missingCoords > 0 && <> {stats.missingCoords} missing coordinates.</>}
                  </>
                )}
            </div>

            <div className="text-xs text-muted-foreground">
              Click <kbd className="px-1 border rounded">Box select</kbd> (or hold <kbd className="px-1 border rounded">Shift</kbd>) and drag on the map. Click pins to toggle individually.
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Button size="sm" variant={boxSelectMode ? "default" : "outline"} onClick={() => setBoxSelectMode((v) => !v)}>
                <SquareDashed className="h-3 w-3 mr-1" />
                {boxSelectMode ? "Drag to box-select…" : "Box select"}
              </Button>
              <span>Mode:</span>
              <Button size="sm" variant={addMode === "replace" ? "default" : "outline"} onClick={() => setAddMode("replace")}>New</Button>
              <Button size="sm" variant={addMode === "add" ? "default" : "outline"} onClick={() => setAddMode("add")}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => { setSelected({}); setSequence(null); setTotals(null); }}>
                <Trash2 className="h-3 w-3 mr-1" />Clear
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Selected: {selectedPins.length}</span>
              {totals && <span className="text-muted-foreground">{totals.km.toFixed(1)} km · {Math.round(totals.min)} min</span>}
            </div>
            <ScrollArea className="flex-1 -mx-1 px-1">
              <div className="space-y-1">
                {sequence ? (
                  sequence.map((k) => pinsByKey[k]).filter(Boolean).map((p, i) => (
                    <div key={p.key} className="flex items-start gap-2 text-xs border rounded p-2 bg-amber-50">
                      <div className="font-mono w-5 text-muted-foreground">{i + 1}</div>
                      <MapPin className={`h-3 w-3 mt-0.5 ${p.type === "pickup" ? "text-blue-600" : "text-green-600"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{p.label}</div>
                        <div className="truncate text-muted-foreground">{p.address}</div>
                      </div>
                    </div>
                  ))
                ) : pins.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic p-2">No stops for this date.</div>
                ) : (
                  pins.map((p) => {
                    const sel = !!selected[p.key];
                    return (
                      <div
                        key={p.key}
                        onClick={() => setSelected((prev) => {
                          const next = { ...prev };
                          if (next[p.key]) delete next[p.key]; else next[p.key] = true;
                          return next;
                        })}
                        className={`flex items-start gap-2 text-xs border rounded p-2 cursor-pointer hover:bg-accent ${sel ? "ring-2 ring-amber-400 bg-amber-50" : ""}`}
                      >
                        <MapPin className={`h-3 w-3 mt-0.5 ${p.type === "pickup" ? "text-blue-600" : "text-green-600"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">{p.label}</div>
                          <div className="truncate text-muted-foreground">{p.address}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </Card>
          <Card className="p-0 overflow-hidden h-[calc(100vh-220px)] bg-white relative">
            <div
              ref={mapContainerRef}
              className="absolute inset-0"
              style={{ cursor: boxSelectMode ? "crosshair" : undefined }}
            >
              <div ref={mapDivRef} className="absolute inset-0 h-full w-full" />
            </div>
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-white/80 pointer-events-none">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading map…
              </div>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}
