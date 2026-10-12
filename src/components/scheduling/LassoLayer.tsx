import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface LassoLayerProps {
  active: boolean;
  points: L.LatLng[];
  onPointsChange: (points: L.LatLng[]) => void;
  onComplete: (polygon: L.LatLng[]) => void;
}

const LINE: L.PolylineOptions = { color: 'hsl(217 91% 60%)', weight: 2, dashArray: '4 4' };

/** Point-to-point lasso: click to add corners; close by clicking the first point or double-clicking. */
const LassoLayer = ({ active, points, onPointsChange, onComplete }: LassoLayerProps) => {
  const map = useMap();
  const ptsRef = useRef(points);
  ptsRef.current = points;
  const cbRef = useRef({ onPointsChange, onComplete });
  cbRef.current = { onPointsChange, onComplete };
  const layerRef = useRef<L.LayerGroup | null>(null);
  const previewRef = useRef<L.Polyline | null>(null);

  // Map interaction
  useEffect(() => {
    if (!active) return;
    const c = map.getContainer();
    map.doubleClickZoom.disable();
    c.style.cursor = 'crosshair';
    const close = (pts: L.LatLng[]) => {
      if (pts.length >= 3) cbRef.current.onComplete(pts);
      cbRef.current.onPointsChange([]);
    };
    const click = (e: L.LeafletMouseEvent) => {
      const pts = ptsRef.current;
      if (pts.length >= 3 && map.latLngToContainerPoint(pts[0]).distanceTo(e.containerPoint) < 12) return close(pts);
      cbRef.current.onPointsChange([...pts, e.latlng]);
    };
    const dbl = () => close(ptsRef.current);
    const move = (e: L.LeafletMouseEvent) => {
      const pts = ptsRef.current;
      if (!pts.length) { previewRef.current?.remove(); previewRef.current = null; return; }
      const seg = [pts[pts.length - 1], e.latlng];
      if (previewRef.current) previewRef.current.setLatLngs(seg);
      else previewRef.current = L.polyline(seg, { ...LINE, opacity: 0.5 }).addTo(map);
    };
    map.on('click', click);
    map.on('dblclick', dbl);
    map.on('mousemove', move);
    return () => {
      map.off('click', click);
      map.off('dblclick', dbl);
      map.off('mousemove', move);
      previewRef.current?.remove();
      previewRef.current = null;
      map.doubleClickZoom.enable();
      c.style.cursor = '';
    };
  }, [active, map]);

  // Draw current points
  useEffect(() => {
    layerRef.current?.remove();
    layerRef.current = null;
    if (!points.length) { previewRef.current?.remove(); previewRef.current = null; }
    if (!active || !points.length) return;
    const g = L.layerGroup().addTo(map);
    L.polyline(points, LINE).addTo(g);
    points.forEach((p, i) =>
      L.circleMarker(p, { radius: i === 0 ? 6 : 4, color: LINE.color, fillOpacity: 1 }).addTo(g)
    );
    layerRef.current = g;
    return () => { g.remove(); };
  }, [points, active, map]);

  return null;
};

export const pointInPolygon = (lat: number, lon: number, poly: L.LatLng[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng, yi = poly[i].lat, xj = poly[j].lng, yj = poly[j].lat;
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export default LassoLayer;
