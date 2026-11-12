import type { Order } from "@/types/order";
import { hasLeftDepot } from "@/utils/storageLocation";

type DepotOrder = Pick<Order, "status" | "orderCollected" | "orderDelivered" | "trackingEvents">;

const shipdayUpdates = (order: DepotOrder): any[] =>
  ((order.trackingEvents as any)?.shipday?.updates as any[]) || [];

/**
 * True once the bike has been picked up from the sender. The order_collected
 * flag wins, so bikes still count as collected after their status moves on
 * (e.g. to scheduled_dates_pending once the receiver picks a delivery date).
 */
export function hasBeenCollected(order: DepotOrder): boolean {
  if (order.orderCollected === true) return true;
  if (order.status === "collected" || order.status === "driver_to_delivery") return true;
  return shipdayUpdates(order).some((u) =>
    u?.description?.toLowerCase().includes("collected") ||
    u?.description?.toLowerCase().includes("pickup") ||
    u?.event === "ORDER_POD_UPLOAD" ||
    u?.status?.toLowerCase().includes("collected"),
  );
}

/** True once the bike has been delivered or otherwise left our depot. */
export function hasBeenDelivered(order: DepotOrder): boolean {
  if (order.orderDelivered === true) return true;
  if (hasLeftDepot(order.status)) return true;
  return shipdayUpdates(order).some((u) =>
    u?.description?.toLowerCase().includes("delivered") ||
    u?.event === "DELIVERY_POD_UPLOAD" ||
    u?.status?.toLowerCase().includes("delivered"),
  );
}
