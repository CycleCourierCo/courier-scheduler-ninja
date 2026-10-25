// Rules for comparing a van's recorded path against its planned stops.
export const VISIT_RADIUS_M = 150;
export const OFF_ROUTE_M = 2000;
export const OFF_ROUTE_MIN_MINUTES = 10;

export interface Pt { lat: number; lon: number }
export interface Sample extends Pt { t: number } // ms epoch

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: Pt, b: Pt): number {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** First time the van came within the visit radius of a stop, or null. */
export function firstVisit(stop: Pt, samples: Sample[], radius = VISIT_RADIUS_M): number | null {
  for (const s of samples) if (haversine(stop, s) <= radius) return s.t;
  return null;
}

/** Distance in metres from p to the planned line (straight segments between stops). */
export function distanceToRoute(p: Pt, route: Pt[]): number {
  if (!route.length) return Infinity;
  if (route.length === 1) return haversine(p, route[0]);
  const kx = 111320 * Math.cos(rad(p.lat)), ky = 110540;
  let best = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1];
    const ax = (a.lon - p.lon) * kx, ay = (a.lat - p.lat) * ky;
    const bx = (b.lon - p.lon) * kx, by = (b.lat - p.lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

export interface OffRouteStretch { start: number; end: number; maxM: number }

/** Stretches more than OFF_ROUTE_M from the plan lasting at least OFF_ROUTE_MIN_MINUTES. */
export function offRouteStretches(samples: Sample[], route: Pt[]): OffRouteStretch[] {
  const out: OffRouteStretch[] = [];
  let cur: OffRouteStretch | null = null;
  for (const s of samples) {
    const d = distanceToRoute(s, route);
    if (d > OFF_ROUTE_M) {
      if (!cur) cur = { start: s.t, end: s.t, maxM: d };
      else { cur.end = s.t; cur.maxM = Math.max(cur.maxM, d); }
    } else if (cur) { push(cur); cur = null; }
  }
  if (cur) push(cur);
  return out;
  function push(c: OffRouteStretch) { if (c.end - c.start >= OFF_ROUTE_MIN_MINUTES * 60_000) out.push(c); }
}

export function pathMiles(samples: Pt[]): number {
  let m = 0;
  for (let i = 1; i < samples.length; i++) m += haversine(samples[i - 1], samples[i]);
  return m / 1609.344;
}
