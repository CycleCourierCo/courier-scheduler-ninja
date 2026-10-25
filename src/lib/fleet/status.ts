export type FleetStatusGroup =
  | "operational"
  | "maintenance_required"
  | "under_repair"
  | "out_of_service"
  | "retired"
  | "other";

export const FLEET_GROUP_LABEL: Record<FleetStatusGroup, string> = {
  operational: "Operational",
  maintenance_required: "Operational — maintenance required",
  under_repair: "Under repair",
  out_of_service: "Out of service",
  retired: "Retired",
  other: "Not yet in service",
};

/** Map the stored vehicle status onto the fleet operational groups. */
export function fleetStatusGroup(status: string | null | undefined): FleetStatusGroup {
  switch (status) {
    case "in_use":
      return "operational";
    case "in_use_maintenance_required":
    case "mot_due":
      return "maintenance_required";
    case "in_repair":
    case "in_service":
      return "under_repair";
    case "off_road":
      return "out_of_service";
    case "sold":
    case "written_off":
      return "retired";
    default:
      return "other";
  }
}

/** Whole days from today (Europe/London) until an ISO date; negative = past. */
export function daysUntil(iso: string | null | undefined, today: Date = new Date()): number | null {
  if (!iso) return null;
  const t = today.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  return Math.round((Date.parse(iso) - Date.parse(t)) / 86_400_000);
}

export type DueState = "overdue" | "due_soon" | "ok" | "none";
export function dueState(iso: string | null | undefined, soonDays = 30, today?: Date): DueState {
  const d = daysUntil(iso, today);
  if (d == null) return "none";
  if (d < 0) return "overdue";
  if (d <= soonDays) return "due_soon";
  return "ok";
}
