export interface LoadersListBike {
  id: string;
  driver: string | null;
  takenOut: boolean;
  takenOutAt?: string | null;
  bay: string;
}

export const UNASSIGNED_DRIVER = "Unassigned";

/** One section per driver (unassigned last); waiting bikes first, taken-out bikes last in time order. */
export function groupLoadersList<T extends LoadersListBike>(bikes: T[]) {
  const groups = new Map<string, T[]>();
  for (const b of bikes) {
    const key = b.driver?.trim() || UNASSIGNED_DRIVER;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === UNASSIGNED_DRIVER ? 1 : b === UNASSIGNED_DRIVER ? -1 : a.localeCompare(b)))
    .map(([driver, list]) => ({
      driver,
      takenOut: list.filter((b) => b.takenOut).length,
      bikes: [...list].sort((a, b) =>
        a.takenOut !== b.takenOut ? (a.takenOut ? 1 : -1)
        : a.takenOut ? String(a.takenOutAt ?? "").localeCompare(String(b.takenOutAt ?? ""))
        : a.bay.localeCompare(b.bay, undefined, { numeric: true })),
    }));
}
