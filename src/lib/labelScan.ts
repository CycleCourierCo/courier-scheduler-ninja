/** Pull the CCC reference out of a scanned label QR (full tracking URL) or typed text. */
export function parseScannedRef(text: string): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  const m = t.match(/\/tracking\/([^/?#\s]+)/i);
  const ref = m ? decodeURIComponent(m[1]) : t;
  return /^[A-Za-z0-9-]{6,64}$/.test(ref) ? ref.toUpperCase() : null;
}

export type ScanPanel = "admin" | "loader" | "driver" | "mechanic" | "staff";

/** Available scan views, preserving the existing role-to-action mapping. */
export function panelsForRoles(roles: string[] = []): ScanPanel[] {
  const has = (r: string) => roles.includes(r);
  const panels: ScanPanel[] = [];
  if (has("admin") || has("cs_agent")) panels.push("admin");
  if (has("loader") || has("route_planner")) panels.push("loader");
  if (has("mechanic")) panels.push("mechanic");
  if (has("driver")) panels.push("driver");
  return panels.length ? panels : ["staff"];
}

/** Which staff panel a scan opens by default. */
export function panelForRoles(roles: string[] = []): ScanPanel {
  return panelsForRoles(roles)[0] ?? "staff";
}

export interface RouteToday { assignment_id: string; route: string; registration: string | null; started: boolean; mine: boolean; stop_types: string[] | null }

/** Drivers may only act on a bike that is on their own route today; stops unlock after depot start. */
export function driverScanState(routes: RouteToday[] = []): "not_on_route" | "before_start" | "on_route" {
  const mine = routes.find((r) => r.mine);
  if (!mine) return "not_on_route";
  return mine.started ? "on_route" : "before_start";
}

/** Roles that get the staff bike card when they scan a label (customers never do). */
export const SCAN_STAFF_ROLES = ["admin", "cs_agent", "loader", "route_planner", "mechanic", "driver"];
export function isScanStaff(roles: string[] = []): boolean {
  return roles.some((r) => SCAN_STAFF_ROLES.includes(r));
}
