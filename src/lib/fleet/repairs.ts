export const REPAIR_STATUSES = [
  { value: "requested", label: "1. Requested" },
  { value: "quote_requested", label: "2. Quote requested" },
  { value: "quoted", label: "3. Quoted" },
  { value: "approved", label: "4. Approved" },
  { value: "booked", label: "5. Booked in" },
  { value: "in_progress", label: "6. In progress" },
  { value: "completed", label: "7. Work completed" },
  { value: "invoiced", label: "8. Invoiced" },
  { value: "verified", label: "9. Verified" },
  { value: "closed", label: "10. Closed" },
  { value: "cancelled", label: "Cancelled" },
] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number]["value"];
export const repairStatusLabel = (s: string) => REPAIR_STATUSES.find((x) => x.value === s)?.label.replace(/^\d+\.\s/, "") ?? s;
export const isRepairOutstanding = (s: string) => !["verified", "closed", "cancelled"].includes(s);
export const isAwaitingVerification = (s: string) => s === "completed" || s === "invoiced";

export function repairVerifyError(j: { status: string; verified_by_name?: string | null }): string | null {
  if ((j.status === "verified" || j.status === "closed") && !j.verified_by_name?.trim()) return "Enter who verified the repair first.";
  return null;
}

/** Best known cost of a repair: final, else labour+parts+VAT, else quote. */
export function repairCost(j: { final_cost?: number | null; labour_cost?: number | null; parts_cost?: number | null; vat?: number | null; quoted_cost?: number | null }): number {
  if (j.final_cost != null) return Number(j.final_cost);
  const parts = [j.labour_cost, j.parts_cost, j.vat].filter((x) => x != null);
  if (parts.length) return parts.reduce((a, b) => a + Number(b), 0);
  return Number(j.quoted_cost ?? 0);
}

export interface CostLine { date: string; kind: "Repair" | "Service" | "Recovery"; description: string; cost: number }

/**
 * Cost summary from repair jobs and service history. A service record created from
 * a repair job (repair_job_id set) is skipped so the same work is never counted twice.
 * Cancelled repairs cost nothing.
 */
export function fleetCostLines(
  repairs: { id: string; title: string; status: string; created_at: string; completed_at?: string | null; final_cost?: number | null; labour_cost?: number | null; parts_cost?: number | null; vat?: number | null; quoted_cost?: number | null }[],
  services: { service_date: string; service_type: string; custom_name?: string | null; cost: number | null; repair_job_id?: string | null }[],
  breakdowns: { title: string; status: string; breakdown_at?: string | null; created_at: string; recovery_cost?: number | null }[] = [],
): CostLine[] {
  const lines: CostLine[] = [];
  // Recovery/tow cost of a breakdown is separate from the repair job that fixes it.
  for (const b of breakdowns) {
    if (b.status === "cancelled" || !b.recovery_cost) continue;
    lines.push({ date: (b.breakdown_at ?? b.created_at).slice(0, 10), kind: "Recovery", description: b.title, cost: Number(b.recovery_cost) });
  }
  for (const r of repairs) {
    if (r.status === "cancelled") continue;
    const c = repairCost(r);
    if (c) lines.push({ date: (r.completed_at ?? r.created_at).slice(0, 10), kind: "Repair", description: r.title, cost: c });
  }
  for (const s of services) {
    if (s.repair_job_id) continue;
    if (s.cost) lines.push({ date: s.service_date, kind: "Service", description: s.custom_name || s.service_type.replace(/_/g, " "), cost: Number(s.cost) });
  }
  return lines.sort((a, b) => b.date.localeCompare(a.date));
}

export function toCsv(lines: CostLine[], reg: string): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return ["Registration,Date,Type,Description,Cost (GBP)", ...lines.map((l) => [esc(reg), l.date, l.kind, esc(l.description), l.cost.toFixed(2)].join(","))].join("\n");
}

export const TYRE_POSITIONS = [
  { value: "front_left", label: "Front left" },
  { value: "front_right", label: "Front right" },
  { value: "rear_left", label: "Rear left" },
  { value: "rear_right", label: "Rear right" },
  { value: "spare", label: "Spare" },
] as const;
