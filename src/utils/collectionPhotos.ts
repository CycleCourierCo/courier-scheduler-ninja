/**
 * Collection (pickup-leg) proof photos.
 *
 * The Shipday webhook stores driver proof-of-delivery images inside the order's
 * `tracking_events.shipday.updates[]` array. Each update carries a `podUrls`
 * array plus the Shipday order id it belongs to, so the collection photos are
 * the ones attached to the pickup leg.
 */

interface ShipdayUpdate {
  event?: string;
  orderId?: string | number;
  podUrls?: string[];
}

interface TrackingEventsLike {
  shipday?: {
    pickup_id?: string | number | null;
    delivery_id?: string | number | null;
    updates?: ShipdayUpdate[];
  } | null;
}

/** Photo URLs uploaded by the driver when the bike was collected. */
export const getCollectionPhotos = (trackingEvents: unknown): string[] => {
  const events = (trackingEvents || null) as TrackingEventsLike | null;
  const updates = events?.shipday?.updates;
  if (!Array.isArray(updates) || updates.length === 0) return [];

  const pickupId = events?.shipday?.pickup_id?.toString();

  const collectionEvent = updates.find(
    (update) =>
      (update?.event === "ORDER_COMPLETED" || update?.event === "ORDER_POD_UPLOAD") &&
      update?.orderId?.toString() === pickupId &&
      Array.isArray(update?.podUrls) &&
      update.podUrls.length > 0
  );

  return collectionEvent?.podUrls || [];
};

/** Convenience wrapper for objects that expose camelCase `trackingEvents`. */
export const getOrderCollectionPhotos = (order: { trackingEvents?: unknown } | undefined | null): string[] =>
  getCollectionPhotos(order?.trackingEvents);
