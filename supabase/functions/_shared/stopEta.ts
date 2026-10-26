// Pure stop-ETA rules shared by the eta-link function and the app's tests.
// No imports, so both Deno and Vitest can load it.

/** Minutes added for every remaining stop before the one being estimated. */
export const STOP_DWELL_MIN = 15;
/** A van position older than this can't be used for live ETAs. */
export const POSITION_MAX_AGE_MIN = 15;
/** A stop counts as reached when the van came within this distance. */
export const VISIT_RADIUS_M = 150;

export interface Leg { seconds: number; meters: number }
export interface StopEta { minutes: number; miles: number; eta: string; stopsBefore: number }

/**
 * legs[i] = road leg arriving at remaining stop i (leg 0 starts at the van).
 * ETA for stop i = drive time of legs 0..i + 15 min × i (stops before it).
 */
export function computeStopEtas(legs: Leg[], now: number, dwellMin = STOP_DWELL_MIN): StopEta[] {
  let secs = 0, meters = 0;
  return legs.map((l, i) => {
    secs += l.seconds; meters += l.meters;
    const total = secs + i * dwellMin * 60;
    return {
      minutes: Math.round(total / 60),
      miles: Math.round((meters / 1609.344) * 10) / 10,
      eta: new Date(now + total * 1000).toISOString(),
      stopsBefore: i,
    };
  });
}

export function isPositionFresh(recordedAt: string | number | null | undefined, now: number, maxMin = POSITION_MAX_AGE_MIN) {
  if (recordedAt == null) return false;
  const t = typeof recordedAt === "number" ? recordedAt : new Date(recordedAt).getTime();
  return Number.isFinite(t) && now - t <= maxMin * 60_000;
}

export function metersBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function wasVisited(stop: { lat: number; lon: number }, path: { lat: number; lon: number }[], radius = VISIT_RADIUS_M) {
  return path.some((p) => metersBetween(stop, p) <= radius);
}
