import { useEffect } from "react";
import L from "leaflet";
import "leaflet.heat";

export interface HeatPoint {
  lat: number;
  lon: number;
  /** 0-1 intensity */
  weight?: number;
}

interface HeatLayerProps {
  /** Map instance captured from MapContainer's ref */
  map: L.Map | null;
  points: HeatPoint[];
  radius?: number;
  blur?: number;
  maxZoom?: number;
  gradient?: Record<number, string>;
}

/**
 * Thin wrapper around leaflet.heat. Rendered as a sibling of the map; it only
 * needs the Leaflet map instance, not the react-leaflet context.
 */
const HeatLayer: React.FC<HeatLayerProps> = ({
  map,
  points,
  radius = 28,
  blur = 20,
  maxZoom = 11,
  gradient,
}) => {
  useEffect(() => {
    if (!map) return;
    const latLngs = points.map((p) => [p.lat, p.lon, p.weight ?? 0.5] as [number, number, number]);
    const layer = (L as any).heatLayer(latLngs, {
      radius,
      blur,
      maxZoom,
      max: 1,
      ...(gradient ? { gradient } : {}),
    });
    layer.addTo(map);
    return () => {
      try {
        map.removeLayer(layer);
      } catch {
        /* map already torn down */
      }
    };
  }, [map, points, radius, blur, maxZoom, gradient]);

  return null;
};

export default HeatLayer;
