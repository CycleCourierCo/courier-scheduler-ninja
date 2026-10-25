// Defect register rules (vehicle_issues). Stored severities stay low/medium/high
// so existing van issue screens keep working; they display as Green/Amber/Red.
export type DefectSeverity = "low" | "medium" | "high";
export type DefectStatus =
  | "open" | "assessed" | "awaiting_parts" | "booked" | "in_repair" | "rectified" | "resolved" | "cancelled";

export const DEFECT_STATUSES: { value: DefectStatus; label: string }[] = [
  { value: "open", label: "Reported" },
  { value: "assessed", label: "Assessed" },
  { value: "awaiting_parts", label: "Awaiting parts" },
  { value: "booked", label: "Booked in for repair" },
  { value: "in_repair", label: "In repair" },
  { value: "rectified", label: "Rectified – awaiting verification" },
  { value: "resolved", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

export const CLOSED_DEFECT_STATUSES: DefectStatus[] = ["resolved", "cancelled"];
export const isDefectOpen = (s: string) => !CLOSED_DEFECT_STATUSES.includes(s as DefectStatus);
export const defectStatusLabel = (s: string) => DEFECT_STATUSES.find((x) => x.value === s)?.label ?? s;

export const SEVERITY_RAG: Record<DefectSeverity, { label: string; variant: "destructive" | "secondary" | "outline" }> = {
  high: { label: "Red", variant: "destructive" },
  medium: { label: "Amber", variant: "secondary" },
  low: { label: "Green", variant: "outline" },
};

/** Returns an error message if the defect can't be closed, else null. Mirrors the database rule. */
export function closeDefectError(d: { severity: string; rectification_evidence?: string | null; verified_by_name?: string | null }): string | null {
  if (d.severity !== "high") return null;
  if (!d.rectification_evidence?.trim()) return "A red defect needs rectification evidence before it can be closed.";
  if (!d.verified_by_name?.trim()) return "A red defect needs the name of the person who verified the repair.";
  return null;
}
