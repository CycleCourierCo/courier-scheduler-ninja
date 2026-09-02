import { formatStorageLocations } from "@/utils/storageLocation";

interface SearchableOrder {
  id: string;
  tracking_number?: string | null;
  sender?: any;
  receiver?: any;
  bike_brand?: string | null;
  bike_model?: string | null;
  storage_locations?: any;
}

/**
 * Case-insensitive partial match across the fields staff actually search by:
 * tracking number, order id, contact names, bike make/model, receiver address
 * and the storage bay the bike sits in.
 */
export function matchesOrderSearch(order: SearchableOrder, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  const addr = order.receiver?.address || {};
  const haystack = [
    order.tracking_number,
    order.id,
    order.sender?.name,
    order.receiver?.name,
    order.bike_brand,
    order.bike_model,
    addr.street,
    addr.city,
    addr.zipCode,
    formatStorageLocations(order.storage_locations),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((part) => haystack.includes(part));
}

export function filterOrdersBySearch<T extends SearchableOrder>(orders: T[], term: string): T[] {
  if (!term.trim()) return orders;
  return orders.filter((o) => matchesOrderSearch(o, term));
}
