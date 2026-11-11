export type StorageSortKey = "bay" | "az" | "za" | "newest" | "oldest";

export interface StorageSortItem {
  /** Customer name shown on the card. */
  name: string;
  /** When the bike went into storage. */
  storedAt: Date;
  bay: string;
  position: number;
}

export const STORAGE_SORT_OPTIONS: { value: StorageSortKey; label: string }[] = [
  { value: "bay", label: "Bay" },
  { value: "az", label: "A-Z" },
  { value: "za", label: "Z-A" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

const byBay = <T extends StorageSortItem>(a: T, b: T) =>
  a.bay !== b.bay
    ? a.bay.localeCompare(b.bay, undefined, { numeric: true })
    : a.position - b.position;

const byNameAsc = <T extends StorageSortItem>(a: T, b: T) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || byBay(a, b);

const byNameDesc = <T extends StorageSortItem>(a: T, b: T) =>
  b.name.localeCompare(a.name, undefined, { sensitivity: "base" }) || byBay(a, b);

const byNewest = <T extends StorageSortItem>(a: T, b: T) =>
  b.storedAt.getTime() - a.storedAt.getTime() || byBay(a, b);

const byOldest = <T extends StorageSortItem>(a: T, b: T) =>
  a.storedAt.getTime() - b.storedAt.getTime() || byBay(a, b);

/**
 * Sorts stored bikes by the chosen filter. Ties (same name, same timestamp)
 * fall back to bay order so the list never jumps around. Unknown keys keep the
 * default bay/position order.
 */
export function sortStorageGroups<T extends StorageSortItem>(items: T[], key: StorageSortKey): T[] {
  const comparator =
    key === "az"
      ? byNameAsc
      : key === "za"
        ? byNameDesc
        : key === "newest"
          ? byNewest
          : key === "oldest"
            ? byOldest
            : byBay;

  return [...items].sort(comparator);
}
