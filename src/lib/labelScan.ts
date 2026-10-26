/** Pull the CCC reference out of a scanned label QR (full tracking URL) or typed text. */
export function parseScannedRef(text: string): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  const m = t.match(/\/tracking\/([^/?#\s]+)/i);
  const ref = m ? decodeURIComponent(m[1]) : t;
  return /^[A-Za-z0-9-]{6,64}$/.test(ref) ? ref.toUpperCase() : null;
}

export type ScanPanel = "admin" | "loader" | "driver" | "mechanic" | "staff";

/** Which staff panel a scan opens, by the strongest role the user holds. */
export function panelForRoles(roles: string[] = []): ScanPanel {
  const has = (r: string) => roles.includes(r);
  if (has("admin") || has("cs_agent")) return "admin";
  if (has("loader") || has("route_planner")) return "loader";
  if (has("mechanic")) return "mechanic";
  if (has("driver")) return "driver";
  return "staff";
}

export interface RouteToday { assignment_id: string; route: string; registration: string | null; started: boolean; mine: boolean; stop_types: string[] | null }

/** Drivers may only act on a bike that is on their own route today; stops unlock after depot start. */
export function driverScanState(routes: RouteToday[] = []): "not_on_route" | "before_start" | "on_route" {
  const mine = routes.find((r) => r.mine);
  if (!mine) return "not_on_route";
  return mine.started ? "on_route" : "before_start";
}
