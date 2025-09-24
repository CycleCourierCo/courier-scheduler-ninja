
import { Order, OrderStatus } from "@/types/order";

export const mapDbOrderToOrderType = (dbOrder: any): Order => {
  if (!dbOrder) {
    throw new Error("Cannot map null or undefined database order");
  }

  
  
  // Convert date strings to Date objects where applicable with validation
  const parseDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    const parsedDate = new Date(dateValue);
    return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  };

  const result: Order = {
    id: dbOrder.id,
    user_id: dbOrder.user_id,
    sender: dbOrder.sender,
    receiver: dbOrder.receiver,
    status: dbOrder.status as OrderStatus,
    createdAt: parseDate(dbOrder.created_at),
    updatedAt: parseDate(dbOrder.updated_at),
    trackingNumber: dbOrder.tracking_number,
    bikeBrand: dbOrder.bike_brand,
    bikeModel: dbOrder.bike_model,
    bikeQuantity: dbOrder.bike_quantity || 1,
    customerOrderNumber: dbOrder.customer_order_number,
    needsPaymentOnCollection: dbOrder.needs_payment_on_collection,
    paymentCollectionPhone: dbOrder.payment_collection_phone,
    isBikeSwap: dbOrder.is_bike_swap,
    isEbayOrder: dbOrder.is_ebay_order || false,
    collectionCode: dbOrder.collection_code,
    deliveryInstructions: dbOrder.delivery_instructions,
    senderNotes: dbOrder.sender_notes,
    receiverNotes: dbOrder.receiver_notes,
    senderPolygonSegment: dbOrder.sender_polygon_segment,
    receiverPolygonSegment: dbOrder.receiver_polygon_segment,
    pickupTimeslot: dbOrder.pickup_timeslot,
    deliveryTimeslot: dbOrder.delivery_timeslot,
    // Handle optional date fields
    trackingEvents: dbOrder.tracking_events,
    storage_locations: dbOrder.storage_locations
  };

  // Add optional date fields only if they exist in the DB record
  if (dbOrder.pickup_date) {
    result.pickupDate = dbOrder.pickup_date;
  }

  if (dbOrder.delivery_date) {
    result.deliveryDate = dbOrder.delivery_date;
  }

  if (dbOrder.scheduled_pickup_date) {
    result.scheduledPickupDate = parseDate(dbOrder.scheduled_pickup_date);
  }

  if (dbOrder.scheduled_delivery_date) {
    result.scheduledDeliveryDate = parseDate(dbOrder.scheduled_delivery_date);
  }

  if (dbOrder.sender_confirmed_at) {
    result.senderConfirmedAt = parseDate(dbOrder.sender_confirmed_at);
  }

  if (dbOrder.receiver_confirmed_at) {
    result.receiverConfirmedAt = parseDate(dbOrder.receiver_confirmed_at);
  }

  if (dbOrder.scheduled_at) {
    result.scheduledAt = parseDate(dbOrder.scheduled_at);
  }

  return result;
};

export const doesOrderNeedDrivers = (order: Order): boolean => {
  return order.status === 'scheduled' && !order.trackingEvents?.shipday;
};
