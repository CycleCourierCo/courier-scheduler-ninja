import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface LassoLayerProps {
  active: boolean;
  onComplete: (polygon: L.LatLng[]) => void;
}

/** Freehand lasso: drag a loop on the map; returns the drawn polygon. */
const LassoLayer = ({ active, onComplete }: LassoLayerProps) => {
  const map = useMap();
  const cbRef = useRef(onComplete);
  cbRef.current = onComplete;

  useEffect(() => {
    if (!active) return;
    const container = map.getContainer();
    map.dragging.disable();
    map.doubleClickZoom.disable();
    container.style.cursor = 'crosshair';
    container.style.touchAction = 'none';

    let path: L.LatLng[] = [];
    let line: L.Polyline | null = null;
    let drawing = false;

    const toLatLng = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      return map.containerPointToLatLng(L.point(e.clientX - rect.left, e.clientY - rect.top));
    };
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.leaflet-control')) return;
      drawing = true;
      path = [toLatLng(e)];
      line = L.polyline(path, { color: 'hsl(217 91% 60%)', weight: 2, dashArray: '4 4' }).addTo(map);
      container.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };
    const move = (e: PointerEvent) => {
      if (!drawing || !line) return;
      path.push(toLatLng(e));
      line.setLatLngs(path);
    };
    const up = () => {
      if (!drawing) return;
      drawing = false;
      line?.remove();
      line = null;
      if (path.length >= 3) cbRef.current(path);
      path = [];
    };

    container.addEventListener('pointerdown', down);
    container.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      container.removeEventListener('pointerdown', down);
      container.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      line?.remove();
      map.dragging.enable();
      map.doubleClickZoom.enable();
      container.style.cursor = '';
      container.style.touchAction = '';
    };
  }, [active, map]);

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
