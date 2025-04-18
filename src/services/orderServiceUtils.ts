
import { Order, OrderStatus } from "@/types/order";

export const mapDbOrderToOrderType = (dbOrder: any): Order => {
  if (!dbOrder) {
    throw new Error("Cannot map null or undefined database order");
  }

  console.log("Mapping DB order to Order type. Raw tracking events:", dbOrder.tracking_events);
  
  // Convert date strings to Date objects where applicable
  const result: Order = {
    id: dbOrder.id,
    user_id: dbOrder.user_id,
    sender: dbOrder.sender,
    receiver: dbOrder.receiver,
    status: dbOrder.status as OrderStatus,
    createdAt: new Date(dbOrder.created_at),
    updatedAt: new Date(dbOrder.updated_at),
    trackingNumber: dbOrder.tracking_number,
    bikeBrand: dbOrder.bike_brand,
    bikeModel: dbOrder.bike_model,
    customerOrderNumber: dbOrder.customer_order_number,
    needsPaymentOnCollection: dbOrder.needs_payment_on_collection,
    isBikeSwap: dbOrder.is_bike_swap,
    deliveryInstructions: dbOrder.delivery_instructions,
    senderNotes: dbOrder.sender_notes,
    receiverNotes: dbOrder.receiver_notes,
    // Handle optional date fields
    trackingEvents: dbOrder.tracking_events
  };

  // Add optional date fields only if they exist in the DB record
  if (dbOrder.pickup_date) {
    result.pickupDate = dbOrder.pickup_date;
  }

  if (dbOrder.delivery_date) {
    result.deliveryDate = dbOrder.delivery_date;
  }

  if (dbOrder.scheduled_pickup_date) {
    result.scheduledPickupDate = new Date(dbOrder.scheduled_pickup_date);
  }

  if (dbOrder.scheduled_delivery_date) {
    result.scheduledDeliveryDate = new Date(dbOrder.scheduled_delivery_date);
  }

  if (dbOrder.sender_confirmed_at) {
    result.senderConfirmedAt = new Date(dbOrder.sender_confirmed_at);
  }

  if (dbOrder.receiver_confirmed_at) {
    result.receiverConfirmedAt = new Date(dbOrder.receiver_confirmed_at);
  }

  if (dbOrder.scheduled_at) {
    result.scheduledAt = new Date(dbOrder.scheduled_at);
  }

  console.log("Mapped order tracking events:", result.trackingEvents);
  return result;
};

export const doesOrderNeedDrivers = (order: Order): boolean => {
  return order.status === 'scheduled' && !order.trackingEvents?.shipday;
};
