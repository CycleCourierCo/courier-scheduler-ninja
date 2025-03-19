
import { Order } from "@/types/order";

/**
 * Maps database order structure to the Order type
 */
export const mapDbOrderToOrderType = (dbOrder: any): Order => {
  return {
    id: dbOrder.id,
    user_id: dbOrder.user_id,
    sender: dbOrder.sender,
    receiver: dbOrder.receiver,
    pickupDate: dbOrder.pickup_date ? JSON.parse(JSON.stringify(dbOrder.pickup_date)) : undefined,
    deliveryDate: dbOrder.delivery_date ? JSON.parse(JSON.stringify(dbOrder.delivery_date)) : undefined,
    scheduledPickupDate: dbOrder.scheduled_pickup_date ? new Date(dbOrder.scheduled_pickup_date) : undefined,
    scheduledDeliveryDate: dbOrder.scheduled_delivery_date ? new Date(dbOrder.scheduled_delivery_date) : undefined,
    senderConfirmedAt: dbOrder.sender_confirmed_at ? new Date(dbOrder.sender_confirmed_at) : undefined,
    receiverConfirmedAt: dbOrder.receiver_confirmed_at ? new Date(dbOrder.receiver_confirmed_at) : undefined,
    scheduledAt: dbOrder.scheduled_at ? new Date(dbOrder.scheduled_at) : undefined,
    status: dbOrder.status,
    createdAt: new Date(dbOrder.created_at),
    updatedAt: new Date(dbOrder.updated_at),
    trackingNumber: dbOrder.tracking_number,
    bikeBrand: dbOrder.bike_brand,
    bikeModel: dbOrder.bike_model,
    customerOrderNumber: dbOrder.customer_order_number,
    needsPaymentOnCollection: dbOrder.needs_payment_on_collection,
    isBikeSwap: dbOrder.is_bike_swap,
    deliveryInstructions: dbOrder.delivery_instructions,
    trackingEvents: dbOrder.tracking_events
  };
};
