import React, { useEffect, useMemo, useState } from "react";
import * as Sentry from "@sentry/react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
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
}

const MAX_STOPS_PER_REQUEST = 20;

const TimeslotRouteMap: React.FC<TimeslotRouteMapProps> = ({ stops, mobile = false }) => {
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
      </MapContainer>
      {(isLoading || pathUnavailable) && (
        <div className="pointer-events-none absolute left-2 top-2 z-[500] rounded border bg-card px-2 py-1 text-xs text-card-foreground shadow-sm">
          {isLoading ? "Loading road route…" : "Road line unavailable — showing stops"}
        </div>
      )}
    </div>
  );
};

export default TimeslotRouteMap;