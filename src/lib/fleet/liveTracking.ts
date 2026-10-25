export interface LivePosition {
  id: number; registration: string; lat: number; lon: number; ignition: boolean; speed: number;
  direction: number | null; street: string | null; town: string | null; post_code: string | null;
  driver_name: string | null; timestamp: number | null;
}
export type LiveStatus = "moving" | "idling" | "off";
export const STALE_MINUTES = 30;

export const normaliseReg = (r: string | null | undefined) => (r ?? "").toUpperCase().replace(/\s+/g, "");

export function liveStatus(p: Pick<LivePosition, "ignition" | "speed">): LiveStatus {
  if (!p.ignition) return "off";
  return p.speed > 0 ? "moving" : "idling";
}

/** timestamp is unix seconds from Radius. */
export function isStale(timestamp: number | null, now = Date.now()): boolean {
  if (!timestamp) return true;
  return now - timestamp * 1000 > STALE_MINUTES * 60_000;
}

export function matchVehicles<V extends { registration: string | null }>(positions: LivePosition[], vehicles: V[]) {
  const byReg = new Map(vehicles.map((v) => [normaliseReg(v.registration), v]));
  return positions.map((p) => ({ position: p, vehicle: byReg.get(normaliseReg(p.registration)) ?? null }));
}
