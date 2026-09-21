import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEPOT_LOCATION } from "@/constants/depot";
import { PlanRoute, decodePolyline } from "@/services/routeGenerationService";

const ROUTE_COLOURS = ["#1d4ed8", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#0369a1"];

const numberedIcon = (label: string, colour: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${colour};color:#fff;border-radius:9999px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)">${label}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

const depotIcon = L.divIcon({
  className: "",
  html: `<div style="background:#111827;color:#fff;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;border:2px solid #fff">Depot</div>`,
  iconSize: [48, 20],
  iconAnchor: [24, 10],
});

interface Props {
  routes: PlanRoute[];
  areas?: { id: string; name: string; geojson: any }[];
}

const RoutePlanMap: React.FC<Props> = ({ routes, areas = [] }) => {
  const lines = useMemo(
    () => routes.map((r) => (r.geometry ? decodePolyline(r.geometry) : [])),
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

        {lines.map((line, i) =>
          line.length > 1 ? (
            <Polyline key={`line-${i}`} positions={line} pathOptions={{ color: ROUTE_COLOURS[i % ROUTE_COLOURS.length], weight: 3, opacity: 0.85 }} />
          ) : null,
        )}

        {routes.map((route, i) =>
          route.stops.map((stop) => (
            <Marker
              key={`${route.route_id}-${stop.seq}`}
              position={[stop.lat, stop.lon]}
              icon={numberedIcon(String(stop.seq), ROUTE_COLOURS[i % ROUTE_COLOURS.length])}
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

        <Marker position={[DEPOT_LOCATION.lat, DEPOT_LOCATION.lon]} icon={depotIcon} />
      </MapContainer>
    </div>
  );
};

export default RoutePlanMap;
