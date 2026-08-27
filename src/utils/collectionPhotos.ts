/**
 * Collection (pickup-leg) proof photos.
 *
 * The Shipday webhook stores driver proof-of-delivery images inside the order's
 * `tracking_events.shipday.updates[]` array. Each update carries a `podUrls`
 * array, a `leg` marker and the Shipday order id it belongs to.
 *
 * We match on the `leg` field first because some orders have a missing or stale
 * `pickup_id` in the tracking block (the leg was re-created later), which would
 * otherwise hide photos that are actually present.
 */

interface ShipdayUpdate {
  event?: string;
  leg?: string;
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

/**
 * Photo URLs uploaded by the driver when the bike was collected.
 * `fallbackPickupId` lets callers pass the order's flat `shipday_pickup_id`
 * column when the tracking block is missing the id.
 */
export const getCollectionPhotos = (
  trackingEvents: unknown,
  fallbackPickupId?: string | number | null
): string[] => {
  const events = (trackingEvents || null) as TrackingEventsLike | null;
  const updates = events?.shipday?.updates;
  if (!Array.isArray(updates) || updates.length === 0) return [];

  const pickupIds = [events?.shipday?.pickup_id, fallbackPickupId]
    .filter((v) => v !== null && v !== undefined && v !== "")
    .map((v) => String(v));
  const deliveryId = events?.shipday?.delivery_id?.toString();

  const isPickup = (update: ShipdayUpdate) => {
    if (update?.leg === "pickup") return true;
    if (update?.leg === "delivery") return false;
    const id = update?.orderId?.toString();
    if (id && pickupIds.includes(id)) return true;
    // Unknown leg and no pickup id to match on: accept anything that clearly
    // isn't the delivery leg.
    if (pickupIds.length === 0 && id && id !== deliveryId) return true;
    return false;
  };

  const collectionEvent = updates.find(
    (update) =>
      (update?.event === "ORDER_COMPLETED" || update?.event === "ORDER_POD_UPLOAD") &&
      isPickup(update) &&
      Array.isArray(update?.podUrls) &&
      update.podUrls.length > 0
  );

  return collectionEvent?.podUrls || [];
};

/** Convenience wrapper for objects that expose camelCase `trackingEvents`. */
export const getOrderCollectionPhotos = (
  order: { trackingEvents?: unknown; shipdayPickupId?: string | number | null } | undefined | null
): string[] => getCollectionPhotos(order?.trackingEvents, order?.shipdayPickupId ?? null);
