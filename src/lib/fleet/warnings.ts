export type WarningLevel = "red" | "amber" | "grey";
export interface FleetWarning { vehicle_id: string; registration: string; level: WarningLevel; code: string; message: string }

const ORDER: Record<WarningLevel, number> = { red: 0, amber: 1, grey: 2 };

/** One entry per van + issue, most serious first. Warnings never block a choice. */
export function dedupeWarnings(ws: FleetWarning[]): FleetWarning[] {
  const seen = new Set<string>();
  return ws
    .filter((w) => { const k = `${w.vehicle_id}|${w.code}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => ORDER[a.level] - ORDER[b.level] || a.registration.localeCompare(b.registration));
}

export const highestLevel = (ws: FleetWarning[]): WarningLevel | null =>
  ws.length ? ws.reduce<WarningLevel>((m, w) => (ORDER[w.level] < ORDER[m] ? w.level : m), "grey") : null;
