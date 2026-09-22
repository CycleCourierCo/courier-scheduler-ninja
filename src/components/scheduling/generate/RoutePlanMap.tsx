import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { DEPOT_LOCATION } from "@/constants/depot";
import { PlanRoute, decodePolyline } from "@/services/routeGenerationService";
import {
  FitRouteBounds,
  ROUTE_LINE_COLOURS,
  RouteLines,
  routeDepotIcon,
  routeNumberIcon,
} from "@/components/scheduling/RouteMapPrimitives";

interface Props {
  routes: PlanRoute[];
  areas?: { id: string; name: string; geojson: any }[];
}

const RoutePlanMap: React.FC<Props> = ({ routes, areas = [] }) => {
  const lines = useMemo(
    () => routes.map((r) => (r.geometry ? decodePolyline(r.geometry) : [])),
    [routes],
  );
  const points = useMemo<[number, number][]>(
    () => [
      [DEPOT_LOCATION.lat, DEPOT_LOCATION.lon],
      ...routes.flatMap((route) => route.stops.map((stop) => [stop.lat, stop.lon] as [number, number])),
    ],
    [routes],
  );

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-md border">
      <MapContainer center={[DEPOT_LOCATION.lat, DEPOT_LOCATION.lon]} zoom={6} className="h-full w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {areas.map((area) => (
          <GeoJSON
            key={area.id}
            data={area.geojson}
            style={() => ({ color: "#b45309", weight: 1, fillOpacity: 0.07 })}
          />
        ))}

        <RouteLines lines={lines} />
        <FitRouteBounds points={points} />

        {routes.map((route, i) =>
          route.stops.map((stop) => (
            <Marker
              key={`${route.route_id}-${stop.seq}`}
              position={[stop.lat, stop.lon]}
               icon={routeNumberIcon(String(stop.seq), i)}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-semibold">{route.van_name} · stop {stop.seq}</div>
                  <div>{stop.label} — {stop.leg_type}</div>
                  <div>{new Date(stop.eta).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </Popup>
            </Marker>
          )),
        )}

         <Marker position={[DEPOT_LOCATION.lat, DEPOT_LOCATION.lon]} icon={routeDepotIcon} />
      </MapContainer>
    </div>
  );
};

export default RoutePlanMap;
