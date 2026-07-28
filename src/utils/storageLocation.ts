/**
 * Helpers for displaying depot storage bay allocations stored on
 * `orders.storage_locations` (JSONB array of allocation objects).
 */

export interface StorageLocationLabelEntry {
  label: string;
  bay: string;
  position: number;
}

/**
 * Parse the loosely-typed `storage_locations` value into sorted "A12" style labels.
 * Handles null, JSON-encoded strings, single objects and arrays.
 */
export function getStorageLocationLabels(raw: any): string[] {
  let value = raw;

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];

  const entries: StorageLocationLabelEntry[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const bay = item.bay ?? item.Bay;
    const position = item.position ?? item.Position;
    if (bay === undefined || bay === null || position === undefined || position === null) continue;
    entries.push({
      bay: String(bay),
      position: Number(position),
      label: `${String(bay)}${position}`,
    });
  }

  entries.sort((a, b) => (a.bay === b.bay ? a.position - b.position : a.bay.localeCompare(b.bay)));

  return entries.map((e) => e.label);
}

/** Single-line summary, e.g. "A12, A13" or null when nothing is allocated. */
export function formatStorageLocations(raw: any): string | null {
  const labels = getStorageLocationLabels(raw);
  return labels.length ? labels.join(", ") : null;
}
