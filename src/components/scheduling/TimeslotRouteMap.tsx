import React, { useEffect, useMemo, useState } from "react";
import * as Sentry from "@sentry/react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { OrderData } from "@/pages/JobScheduling";
import { getLegContact } from "@/utils/niDelivery";
import { isLegExpired, isLegViableOnDate } from "./heatJobPoints";
import { DEPOT_LOCATION } from "@/constants/depot";
import { supabase } from "@/integrations/supabase/client";
import { decodePolyline } from "@/services/routeGenerationService";
import {
  FitRouteBounds,
  RouteLines,
  routeDepotIcon,
  routeNumberIcon,
} from "./RouteMapPrimitives";

export interface TimeslotMapStop {
  orderId: string;
  type: "pickup" | "delivery" | "break";
  contactName: string;
  address: string;
  lat?: number;
  lon?: number;
  estimatedTime?: string;
  trackingNumber?: string;
}

interface TimeslotRouteMapProps {
  stops: TimeslotMapStop[];
  mobile?: boolean;
  orders?: OrderData[];
  routeDate?: Date;
  onAddCandidate?: (order: OrderData, type: "pickup" | "delivery") => void;
}

const RADII = [2, 5, 10, 20];
const milesBetween = (a: [number, number], b: [number, number]) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b[0] - a[0]);
  const dLon = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
};
const candidateIcon = (type: "pickup" | "delivery", expired = false) =>
  L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:${type === "pickup" ? "50%" : "3px"};background:${expired ? "#CB2B3E" : `hsl(var(${type === "pickup" ? "--primary" : "--destructive"}))`};opacity:${expired ? ".9" : ".65"};border:2px solid hsl(var(--background))"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });

const MAX_STOPS_PER_REQUEST = 20;

const TimeslotRouteMap: React.FC<TimeslotRouteMapProps> = ({ stops, mobile = false, orders = [], routeDate, onAddCandidate }) => {
  const [showNearby, setShowNearby] = useState(true);
  const [radius, setRadius] = useState(5);
  const mappedStops = useMemo(
    () => stops.filter(
      (stop): stop is TimeslotMapStop & { lat: number; lon: number; type: "pickup" | "delivery" } =>
        stop.type !== "break" && Number.isFinite(stop.lat) && Number.isFinite(stop.lon),
    ),
    [stops],
  );
  const [routeLines, setRouteLines] = useState<[number, number][][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pathUnavailable, setPathUnavailable] = useState(false);

  const points = useMemo<[number, number][]>(
    () => [
      [DEPOT_LOCATION.lat, DEPOT_LOCATION.lon],
      ...mappedStops.map((stop) => [stop.lat, stop.lon] as [number, number]),
    ],
    [mappedStops],
  );

  const candidates = useMemo(() => {
    if (!showNearby || !routeDate || !onAddCandidate) return [];
    const onRoute = new Set(stops.map((s) => `${s.orderId}-${s.type}`));
    const out: { order: OrderData; type: "pickup" | "delivery"; lat: number; lon: number; miles: number; name: string; address: string; expired: boolean }[] = [];
    for (const order of orders) {
      for (const type of ["pickup", "delivery"] as const) {
        if (onRoute.has(`${order.id}-${type}`)) continue;
        const legType = type === "pickup" ? "collection" : "delivery";
        const collectedOnRoute = type === "delivery" && onRoute.has(`${order.id}-pickup`);
        const viable = isLegViableOnDate(order, legType, routeDate, { collectedOnRoute });
        const expired = !viable && isLegExpired(order, legType, { collectedOnRoute });
        if (!viable && !expired) continue;
        const c: any = getLegContact(order, type);
        const lat = c?.lat ?? c?.address?.lat;
        const lon = c?.lon ?? c?.address?.lon;
        if (typeof lat !== "number" || typeof lon !== "number") continue;
        const miles = Math.min(...points.map((p) => milesBetween(p, [lat, lon])));
        if (miles > radius) continue;
        const a = c?.address || {};
        out.push({ order, type, lat, lon, miles, name: c?.name || "", address: [a.street, a.city, a.zipCode].filter(Boolean).join(", ") });
      }
    }
    return out;
  }, [showNearby, routeDate, onAddCandidate, stops, orders, points, radius]);

  useEffect(() => {
    let active = true;

    const loadRoute = async () => {
      if (mappedStops.length === 0) {
        setRouteLines([]);
        setPathUnavailable(false);
        return;
      }

      setIsLoading(true);
      setPathUnavailable(false);
      const lines: [number, number][][] = [];
      let origin = { lat: DEPOT_LOCATION.lat, lon: DEPOT_LOCATION.lon };

      try {
        for (let index = 0; index < mappedStops.length; index += MAX_STOPS_PER_REQUEST) {
          if (!active) return;
          const batch = mappedStops.slice(index, index + MAX_STOPS_PER_REQUEST);
          const isFinalBatch = index + MAX_STOPS_PER_REQUEST >= mappedStops.length;
          const finalStop = batch[batch.length - 1];
          if (!finalStop) continue;

          const destination = isFinalBatch
            ? { lat: DEPOT_LOCATION.lat, lon: DEPOT_LOCATION.lon }
            : { lat: finalStop.lat, lon: finalStop.lon };
          const intermediates = isFinalBatch ? batch : batch.slice(0, -1);
          const { data, error } = await supabase.functions.invoke("route-path", {
            body: {
              origin,
              stops: intermediates.map((stop) => ({ lat: stop.lat, lon: stop.lon })),
              destination,
            },
          });
          if (error || typeof data?.encodedPolyline !== "string") throw error ?? new Error("No route returned");
          lines.push(decodePolyline(data.encodedPolyline));
          origin = destination;
        }

        if (active) setRouteLines(lines);
      } catch (error) {
        Sentry.captureException(error, { tags: { feature: "timeslot-route-map" } });
        if (active) {
          setRouteLines([]);
          setPathUnavailable(true);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadRoute();
    return () => { active = false; };
  }, [mappedStops]);

  if (mappedStops.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
        No stops with coordinates to show on the map.
      </div>
    );
  }

  return (
    <div className="space-y-2">
    {onAddCandidate && (
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2">
          <Switch checked={showNearby} onCheckedChange={setShowNearby} />
          Show nearby jobs that could go on this route
        </label>
        {showNearby && (
          <>
            <select className="rounded border bg-background px-1 py-0.5" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              {RADII.map((r) => <option key={r} value={r}>within {r} miles</option>)}
            </select>
            <span className="text-muted-foreground">{candidates.length} nearby · ● collection ■ delivery</span>
          </>
        )}
      </div>
    )}
    <div className={`relative w-full overflow-hidden rounded-md border bg-muted ${mobile ? "h-64" : "h-[420px]"}`}>
      <MapContainer
        center={[DEPOT_LOCATION.lat, DEPOT_LOCATION.lon]}
        zoom={6}
        className="h-full w-full"
        scrollWheelZoom={!mobile}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <RouteLines lines={routeLines} />
        <FitRouteBounds points={points} />
        <Marker position={[DEPOT_LOCATION.lat, DEPOT_LOCATION.lon]} icon={routeDepotIcon}>
          <Popup>
            <div className="text-xs">
              <p className="font-semibold">Start and finish</p>
              <p>{DEPOT_LOCATION.address}</p>
            </div>
          </Popup>
        </Marker>
        {mappedStops.map((stop, index) => (
          <Marker
            key={`${stop.orderId}-${stop.type}-${index}`}
            position={[stop.lat, stop.lon]}
            icon={routeNumberIcon(String(index + 1))}
          >
            <Popup>
              <div className="min-w-40 text-xs">
                <p className="font-semibold">{index + 1}. {stop.contactName}</p>
                <p className="capitalize">{stop.type === "pickup" ? "Collection" : "Delivery"}</p>
                <p>{stop.address}</p>
                {stop.trackingNumber && <p>Order: {stop.trackingNumber}</p>}
                {stop.estimatedTime && <p className="font-semibold">ETA {stop.estimatedTime}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
        {candidates.map((c) => (
          <Marker key={`cand-${c.order.id}-${c.type}`} position={[c.lat, c.lon]} icon={candidateIcon(c.type)}>
            <Popup>
              <div className="min-w-40 space-y-1 text-xs">
                <p className="font-semibold">{c.name}</p>
                <p>{c.type === "pickup" ? "Collection" : "Delivery"} · {c.miles.toFixed(1)} miles from route</p>
                <p>{c.address}</p>
                {c.order.tracking_number && <p>Order: {c.order.tracking_number}</p>}
                <Button size="sm" className="h-7 w-full" onClick={() => onAddCandidate?.(c.order, c.type)}>Add to route</Button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {(isLoading || pathUnavailable) && (
        <div className="pointer-events-none absolute left-2 top-2 z-[500] rounded border bg-card px-2 py-1 text-xs text-card-foreground shadow-sm">
          {isLoading ? "Loading road route…" : "Road line unavailable — showing stops"}
        </div>
      )}
    </div>
    </div>
  );
};

export default TimeslotRouteMap;