import { Order } from "@/types/order";

export interface GroupedBike {
  label: string;
  brand: string;
  model: string;
  type: string;
  value?: string;
  quantity: number;
}

/**
 * Groups bikes by unique combination of brand + model + type (which includes size).
 * Falls back to legacy single-bike fields for older orders without a bikes array.
 */
export function getGroupedBikes(order: Order): GroupedBike[] {
  if (order.bikes && order.bikes.length > 0) {
    const groups = new Map<string, GroupedBike>();

    for (const bike of order.bikes) {
      const brand = (bike.brand || "").trim();
      const model = (bike.model || "").trim();
      const type = (bike.type || "").trim();
      const value = (bike.value || "").toString().trim();
      const key = `${brand}||${model}||${type}||${value}`.toLowerCase();

      const existing = groups.get(key);
      if (existing) {
        existing.quantity += 1;
      } else {
        const parts = [brand, model].filter(Boolean).join(" ");
        const label = type ? `${parts} — ${type}` : parts || "Bike";
        groups.set(key, { label, brand, model, type, value: value || undefined, quantity: 1 });
      }
    }

    return Array.from(groups.values());
  }

  // Legacy fallback
  const brand = (order.bikeBrand || "").trim();
  const model = (order.bikeModel || "").trim();
  const type = (order.bikeType || "").trim();
  const parts = [brand, model].filter(Boolean).join(" ");
  const label = type ? `${parts} — ${type}` : parts || "Bike";

  return [{ label, brand, model, type, quantity: order.bikeQuantity || 1 }];
}

/** Returns a short title like "Bike Name" or "5 bikes (3 unique)" */
export function getBikeTitle(order: Order): string {
  const groups = getGroupedBikes(order);
  const total = groups.reduce((sum, g) => sum + g.quantity, 0);

  if (groups.length === 1 && total === 1) {
    return groups[0].label;
  }

  if (groups.length === 1) {
    return `${total}× ${groups[0].label}`;
  }

  return `${total} bikes (${groups.length} unique)`;
}
