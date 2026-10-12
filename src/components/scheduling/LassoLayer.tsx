import { useEffect, useRef, useState } from 'react';
import { useMap, useMapEvents, Polyline, CircleMarker } from 'react-leaflet';
import L from 'leaflet';

interface LassoLayerProps {
  active: boolean;
  points: L.LatLng[];
  onPointsChange: (points: L.LatLng[]) => void;
  onComplete: (polygon: L.LatLng[]) => void;
}

const LINE = { color: 'hsl(217 91% 60%)', weight: 2, dashArray: '4 4' };

/** Point-to-point lasso: click to add corners; close by clicking the first point or double-clicking. */
const LassoLayer = ({ active, points, onPointsChange, onComplete }: LassoLayerProps) => {
  const map = useMap();
  const [hover, setHover] = useState<L.LatLng | null>(null);
  const ptsRef = useRef(points);
  ptsRef.current = points;

  useEffect(() => {
    if (!active) { setHover(null); return; }
    const c = map.getContainer();
    map.doubleClickZoom.disable();
    c.style.cursor = 'crosshair';
    return () => { map.doubleClickZoom.enable(); c.style.cursor = ''; };
  }, [active, map]);

  const close = (pts: L.LatLng[]) => {
    if (pts.length >= 3) onComplete(pts);
    onPointsChange([]);
  };

  useMapEvents({
    click(e) {
      if (!active) return;
      const pts = ptsRef.current;
      if (pts.length >= 3) {
        const first = map.latLngToContainerPoint(pts[0]);
        if (first.distanceTo(e.containerPoint) < 12) return close(pts);
      }
      onPointsChange([...pts, e.latlng]);
    },
    dblclick() {
      if (active) close(ptsRef.current);
    },
    mousemove(e) {
      if (active && ptsRef.current.length) setHover(e.latlng);
    },
  });

  if (!active || points.length === 0) return null;
  return (
    <>
      <Polyline positions={points} pathOptions={LINE} />
      {hover && <Polyline positions={[points[points.length - 1], hover]} pathOptions={{ ...LINE, opacity: 0.5 }} />}
      {points.map((p, i) => (
        <CircleMarker key={i} center={p} radius={i === 0 ? 6 : 4} pathOptions={{ color: LINE.color, fillOpacity: 1 }} />
      ))}
    </>
  );
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
