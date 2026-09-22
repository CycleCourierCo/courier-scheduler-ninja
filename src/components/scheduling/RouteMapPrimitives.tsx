import React, { useEffect } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";

export const ROUTE_LINE_COLOURS = [
  "hsl(var(--segment-1))",
  "hsl(var(--segment-2))",
  "hsl(var(--segment-3))",
  "hsl(var(--segment-4))",
  "hsl(var(--segment-5))",
  "hsl(var(--segment-6))",
];

const segmentNumber = (routeIndex: number) => (routeIndex % ROUTE_LINE_COLOURS.length) + 1;

export const routeNumberIcon = (label: string, routeIndex = 0) =>
  L.divIcon({
    className: "",
    html: `<div class="route-map-marker" style="--route-marker: var(--segment-${segmentNumber(routeIndex)})">${label}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -13],
  });

export const routeDepotIcon = L.divIcon({
  className: "",
  html: '<div class="route-map-depot">Depot</div>',
  iconSize: [48, 20],
  iconAnchor: [24, 10],
  popupAnchor: [0, -12],
});

export const RouteLines: React.FC<{
  lines: [number, number][][];
  colours?: string[];
}> = ({ lines, colours = ROUTE_LINE_COLOURS }) => {
  const map = useMap();

  useEffect(() => {
    const layers = lines
      .filter((line) => line.length > 1)
      .map((line, index) => L.polyline(line, {
        color: colours[index % colours.length],
        weight: 3,
        opacity: 0.85,
      }).addTo(map));

    return () => layers.forEach((layer) => map.removeLayer(layer));
  }, [colours, lines, map]);

  return null;
};

export const FitRouteBounds: React.FC<{ points: [number, number][] }> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 13 });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [map, points]);

  return null;
};