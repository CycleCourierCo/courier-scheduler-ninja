import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

export interface HeatPoint {
  lat: number;
  lon: number;
  /** 0-1 intensity */
  weight?: number;
}

interface HeatLayerProps {
  points: HeatPoint[];
  radius?: number;
  blur?: number;
  maxZoom?: number;
  gradient?: Record<number, string>;
}

/**
 * Thin react-leaflet wrapper around leaflet.heat.
 */
const HeatLayer: React.FC<HeatLayerProps> = ({
  points,
  radius = 28,
  blur = 20,
  maxZoom = 11,
  gradient,
}) => {
  const map = useMap();

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
      map.removeLayer(layer);
    };
  }, [map, points, radius, blur, maxZoom, gradient]);

  return null;
};

export default HeatLayer;
