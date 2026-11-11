/**
 * Workshop inspection list: has the bike been picked up from the sender?
 *
 * The order_collected flag is the source of truth (set by drivers, the
 * Loading page and "Mark as collected"). collection_confirmation_sent_at only
 * records that the collection email went out, so it is a fallback, never the
 * only signal — otherwise manually-collected bikes stay under "Awaiting".
 */
export function isInspectionOrderCollected(order: any): boolean {
  if (!order) return false;
  if (order.order_collected === true) return true;
  if (order.collection_confirmation_sent_at) return true;
  return order.status === "collected" || order.status === "driver_to_delivery";
}

/** Best-known collection time, for "Collected X ago", sorting and date filters. */
export function getInspectionCollectedAt(order: any): string | null {
  if (!isInspectionOrderCollected(order)) return null;
  return (
    order.collection_confirmation_sent_at ||
    order.scheduled_pickup_date ||
    order.updated_at ||
    null
  );
}
