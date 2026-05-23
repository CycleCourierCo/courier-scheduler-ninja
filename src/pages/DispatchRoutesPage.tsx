import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Loader2, Wand2, Plus, Trash2, Save, MapPin } from "lucide-react";

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

type Pin = {
  key: string; // stable: `${orderId}:${type}`
  orderId: string;
  type: "pickup" | "delivery";
  lat: number;
  lon: number;
  label: string;
  address: string;
};

function pickPins(orders: Order[]): Pin[] {
  const pins: Pin[] = [];
  for (const o of orders) {
    const senderAny: any = (o as any).sender ?? {};
    const receiverAny: any = (o as any).receiver ?? {};
    const sLat = senderAny.lat ?? senderAny.latitude;
    const sLon = senderAny.lon ?? senderAny.longitude;
    const rLat = receiverAny.lat ?? receiverAny.latitude;
    const rLon = receiverAny.lon ?? receiverAny.longitude;
    const tn = o.trackingNumber || o.id.slice(0, 6);
    const collected = (o as any).order_collected ?? (o as any).orderCollected ?? false;
    const delivered = (o as any).order_delivered ?? (o as any).orderDelivered ?? false;
    if (typeof sLat === "number" && typeof sLon === "number" && !collected) {
      pins.push({
        key: `${o.id}:pickup`,
        orderId: o.id,
        type: "pickup",
        lat: sLat,
        lon: sLon,
        label: `${tn} · Pick-up · ${senderAny.name ?? ""}`,
        address: [senderAny.address?.street, senderAny.address?.city, senderAny.address?.postal_code]
          .filter(Boolean).join(", "),
      });
    }
    if (typeof rLat === "number" && typeof rLon === "number" && !delivered) {
      pins.push({
        key: `${o.id}:delivery`,
        orderId: o.id,
        type: "delivery",
        lat: rLat,
        lon: rLon,
        label: `${tn} · Delivery · ${receiverAny.name ?? ""}`,
        address: [receiverAny.address?.street, receiverAny.address?.city, receiverAny.address?.postal_code]
          .filter(Boolean).join(", "),
      });
    }
  }
  return pins;
}

const UK_CENTER = { lat: 52.5, lng: -1.5 };

export default function DispatchRoutesPage() {
  const qc = useQueryClient();
  const { ready, error: mapsError } = useGoogleMaps(["drawing", "geometry"]);

  const [routeDate, setRouteDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [routeName, setRouteName] = useState<string>("Route 1");
  const [selected, setSelected] = useState<Record<string, true>>({}); // pin keys
  const [addMode, setAddMode] = useState<"replace" | "add">("replace");
  const [driverId, setDriverId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [optimising, setOptimising] = useState(false);
  const [sequence, setSequence] = useState<string[] | null>(null);
  const [totals, setTotals] = useState<{ km: number; min: number } | null>(null);

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const drawingMgrRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  // Orders for the chosen date — pickups OR deliveries scheduled on that date
  const ordersQuery = useQuery({
    queryKey: ["dispatch-orders-all"],
    queryFn: getOrders,
  });

  const drivers = useQuery({
    queryKey: ["dispatch-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("role", "driver" as any)
        .eq("is_active", true)
        .order("name");
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

  const assignedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const r of existingStops.data ?? []) s.add(`${r.order_id}:${r.stop_type}`);
    return s;
  }, [existingStops.data]);

  const dateOrders = useMemo(() => {
    const all = ordersQuery.data ?? [];
    return all.filter((o) => {
      const p = (o as any).scheduled_pickup_date ?? o.scheduledPickupDate;
      const d = (o as any).scheduled_delivery_date ?? o.scheduledDeliveryDate;
      const inDate = (v: any) => v && format(new Date(v), "yyyy-MM-dd") === routeDate;
      return inDate(p) || inDate(d);
    });
  }, [ordersQuery.data, routeDate]);

  const pins = useMemo(() => pickPins(dateOrders).filter((p) => !assignedKeys.has(p.key)), [dateOrders, assignedKeys]);
  const pinsByKey = useMemo(() => Object.fromEntries(pins.map((p) => [p.key, p])), [pins]);

  // Init map
  useEffect(() => {
    if (!ready || !mapDivRef.current || mapRef.current) return;
    const g = (window as any).google;
    const map = new g.maps.Map(mapDivRef.current, {
      center: UK_CENTER, zoom: 7,
      mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
    });
    mapRef.current = map;

    const dm = new g.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: true,
      drawingControlOptions: {
        position: g.maps.ControlPosition.TOP_CENTER,
        drawingModes: [g.maps.drawing.OverlayType.POLYGON],
      },
      polygonOptions: { fillOpacity: 0.15, strokeWeight: 2, clickable: false, editable: false, zIndex: 1 },
    });
    dm.setMap(map);
    drawingMgrRef.current = dm;

    g.maps.event.addListener(dm, "polygoncomplete", (poly: any) => {
      const hits: string[] = [];
      for (const key in markersRef.current) {
        const m = markersRef.current[key];
        if (g.maps.geometry.poly.containsLocation(m.getPosition(), poly)) hits.push(key);
      }
      setSelected((prev) => {
        const base = addMode === "add" ? { ...prev } : {};
        for (const h of hits) base[h] = true;
        return base;
      });
      poly.setMap(null);
      dm.setDrawingMode(null);
    });
  }, [ready, addMode]);

  // Render markers
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = (window as any).google;
    // remove old
    for (const k of Object.keys(markersRef.current)) {
      if (!pinsByKey[k]) { markersRef.current[k].setMap(null); delete markersRef.current[k]; }
    }
    // add/update
    const bounds = new g.maps.LatLngBounds();
    let hasAny = false;
    for (const p of pins) {
      hasAny = true;
      const sel = !!selected[p.key];
      const color = p.type === "pickup" ? "#2563eb" : "#16a34a";
      const existing = markersRef.current[p.key];
      const pos = { lat: p.lat, lng: p.lon };
      if (existing) {
        existing.setPosition(pos);
        existing.setIcon({
          path: g.maps.SymbolPath.CIRCLE,
          fillColor: sel ? "#f59e0b" : color,
          fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, scale: sel ? 9 : 7,
        });
      } else {
        const m = new g.maps.Marker({
          map: mapRef.current, position: pos, title: p.label,
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            fillColor: sel ? "#f59e0b" : color,
            fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, scale: sel ? 9 : 7,
          },
        });
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

  // Draw optimised route polyline
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = (window as any).google;
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    if (!sequence || sequence.length < 2) return;
    const path = sequence.map((k) => {
      const p = pinsByKey[k];
      return p ? { lat: p.lat, lng: p.lon } : null;
    }).filter(Boolean) as any[];
    polylineRef.current = new g.maps.Polyline({
      map: mapRef.current, path,
      geodesic: true, strokeColor: "#6366f1", strokeOpacity: 0.9, strokeWeight: 4,
    });
  }, [sequence, ready, pinsByKey]);

  const selectedPins = pins.filter((p) => selected[p.key]);

  const handleOptimise = async () => {
    if (selectedPins.length < 2) {
      toast({ title: "Select at least 2 stops", variant: "destructive" });
      return;
    }
    setOptimising(true);
    try {
      const { data, error } = await supabase.functions.invoke("optimise-route", {
        body: { stops: selectedPins.map((p) => ({ id: p.key, lat: p.lat, lon: p.lon })) },
      });
      if (error) throw error;
      const seq: { stop_id: string; sequence: number }[] = data.sequence ?? [];
      setSequence(seq.map((s) => s.stop_id));
      setTotals({ km: data.total_distance_km, min: data.total_duration_min });
      toast({ title: "Route optimised", description: `${seq.length} stops · ${data.total_distance_km?.toFixed(1)} km · ${Math.round(data.total_duration_min)} min` });
    } catch (e: any) {
      toast({ title: "Optimise failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setOptimising(false);
    }
  };

  const handleSave = async () => {
    if (selectedPins.length < 1) {
      toast({ title: "Select at least 1 stop", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const seq = sequence ?? selectedPins.map((p) => p.key);
      const { data: route, error: rErr } = await supabase
        .from("dispatch_routes" as any)
        .insert({
          name: routeName || `Route ${routeDate}`,
          route_date: routeDate,
          driver_id: driverId || null,
          status: driverId ? "assigned" : "draft",
          total_distance_km: totals?.km ?? null,
          total_duration_min: totals?.min ?? null,
          optimised_at: totals ? new Date().toISOString() : null,
          created_by: user.user?.id ?? null,
        })
        .select("id")
        .single();
      if (rErr) throw rErr;
      const stopsPayload = seq.map((key, i) => {
        const p = pinsByKey[key];
        return {
          route_id: (route as any).id,
          order_id: p.orderId,
          stop_type: p.type,
          sequence: i + 1,
          address: p.address,
          lat: p.lat,
          lon: p.lon,
        };
      });
      const { error: sErr } = await supabase.from("dispatch_route_stops" as any).insert(stopsPayload);
      if (sErr) throw sErr;
      toast({ title: "Route saved", description: `${seq.length} stops` });
      setSelected({});
      setSequence(null);
      setTotals(null);
      qc.invalidateQueries({ queryKey: ["dispatch-existing-stops", routeDate] });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
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
          <div className="flex gap-2 ml-auto">
            <Link to="/dispatch/orders"><Button variant="outline">Orders</Button></Link>
            <Button onClick={handleOptimise} disabled={optimising || selectedPins.length < 2}>
              {optimising ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
              Optimise
            </Button>
            <Button onClick={handleSave} disabled={saving || selectedPins.length < 1} variant="default">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save route
            </Button>
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
            <div className="text-xs text-muted-foreground">
              Lasso the map to select. Hold <kbd className="px-1 border rounded">Shift</kbd> while drawing to add to current selection. Click pins to toggle individually.
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span>Lasso mode:</span>
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
                {(sequence ? sequence.map((k) => pinsByKey[k]).filter(Boolean) : selectedPins).map((p, i) => (
                  <div key={p.key} className="flex items-start gap-2 text-xs border rounded p-2">
                    <div className="font-mono w-5 text-muted-foreground">{i + 1}</div>
                    <MapPin className={`h-3 w-3 mt-0.5 ${p.type === "pickup" ? "text-blue-600" : "text-green-600"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{p.label}</div>
                      <div className="truncate text-muted-foreground">{p.address}</div>
                    </div>
                  </div>
                ))}
                {selectedPins.length === 0 && (
                  <div className="text-xs text-muted-foreground italic p-2">No stops selected.</div>
                )}
              </div>
            </ScrollArea>
          </Card>
          <Card className="p-0 overflow-hidden h-[calc(100vh-220px)]">
            {!ready ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading map…
              </div>
            ) : (
              <div ref={mapDivRef} className="h-full w-full" />
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}
