// Planned (saved route) vs completed (timeslip) comparison.
export interface PlannedStop { orderId?: string; type?: string; estimatedTime?: string; address?: string; lat?: number; lon?: number; order?: number }
export interface DoneStop { order_id?: string; type?: string; postcode?: string }

export type StopOutcome = "done" | "missed" | "extra";
export interface StopRow {
  key: string; orderId: string; type: string; address: string;
  outcome: StopOutcome; plannedTime: string | null; actualTime: string | null; lateMinutes: number | null;
}

const keyOf = (orderId?: string, type?: string) => `${orderId ?? ""}:${type ?? ""}`;
const toMinutes = (hhmm: string | null) => {
  const m = hhmm?.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Saved route sharing the most orders with the timeslip; null when none share any. */
export function suggestSavedRoute(orderIds: string[], routes: { id: string; stops: PlannedStop[] }[]): string | null {
  const ids = new Set(orderIds.filter(Boolean));
  if (!ids.size) return null;
  let best: string | null = null, bestN = 0;
  for (const r of routes) {
    const n = new Set(r.stops.map((s) => s.orderId).filter((o) => o && ids.has(o))).size;
    if (n > bestN) { best = r.id; bestN = n; }
  }
  return best;
}

/**
 * Compare stops. actualTimes maps "orderId:type" to the HH:mm the van reached that stop (from tracking).
 * A planned stop is done when it's on the timeslip or tracking saw it; otherwise missed. Timeslip stops not planned are extra.
 */
export function compareStops(planned: PlannedStop[], done: DoneStop[], actualTimes: Record<string, string> = {}): StopRow[] {
  const doneKeys = new Set(done.map((d) => keyOf(d.order_id, d.type)));
  const plannedKeys = new Set(planned.map((p) => keyOf(p.orderId, p.type)));
  const rows: StopRow[] = planned.map((p) => {
    const k = keyOf(p.orderId, p.type);
    const actual = actualTimes[k] ?? null;
    const pm = toMinutes(p.estimatedTime ?? null), am = toMinutes(actual);
    return {
      key: k, orderId: p.orderId ?? "", type: p.type ?? "", address: p.address ?? "",
      outcome: doneKeys.has(k) || actual ? "done" : "missed",
      plannedTime: p.estimatedTime ?? null, actualTime: actual,
      lateMinutes: pm != null && am != null ? am - pm : null,
    };
  });
  for (const d of done) {
    const k = keyOf(d.order_id, d.type);
    if (!plannedKeys.has(k)) rows.push({ key: k, orderId: d.order_id ?? "", type: d.type ?? "", address: d.postcode ?? "", outcome: "extra", plannedTime: null, actualTime: actualTimes[k] ?? null, lateMinutes: null });
  }
  return rows;
}

export function summarise(rows: StopRow[]) {
  const late = rows.filter((r) => (r.lateMinutes ?? 0) > 0);
  return {
    planned: rows.filter((r) => r.outcome !== "extra").length,
    done: rows.filter((r) => r.outcome === "done").length,
    missed: rows.filter((r) => r.outcome === "missed").length,
    extra: rows.filter((r) => r.outcome === "extra").length,
    lateStops: late.length,
    avgLateMinutes: late.length ? Math.round(late.reduce((s, r) => s + (r.lateMinutes ?? 0), 0) / late.length) : 0,
  };
}

export function milesDifference(plannedMiles: number | null, actualMiles: number | null): number | null {
  if (plannedMiles == null || actualMiles == null) return null;
  return Math.round((actualMiles - plannedMiles) * 10) / 10;
}
