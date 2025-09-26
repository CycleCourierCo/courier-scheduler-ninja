import { Order } from "@/types/order";

/**
 * Utility functions for handling driver assignments consistently across the application
 * Collection assignments should match pickup_id, delivery assignments should match delivery_id
 */

// Get the most recent driver assignment for pickup or delivery
export const getDriverAssignment = (order: Order, type: 'pickup' | 'delivery'): string | null => {
  const targetId = type === 'pickup' 
    ? order.trackingEvents?.shipday?.pickup_id?.toString()
    : order.trackingEvents?.shipday?.delivery_id?.toString();
  
  if (!targetId) return null;
  
  const assignmentEvents = order.trackingEvents?.shipday?.updates?.filter(
    (update: any) => update.event === 'ORDER_ASSIGNED' && 
    update.orderId?.toString() === targetId &&
    update.driverName
  );
  
  // Get the most recent assignment event
  const latestEvent = assignmentEvents?.length > 0 ? assignmentEvents[assignmentEvents.length - 1] : null;
  return latestEvent?.driverName || null;
};

// Get driver name from a completed pickup/delivery event
export const getCompletedDriverName = (order: Order, type: 'pickup' | 'delivery'): string | null => {
  const targetId = type === 'pickup' 
    ? order.trackingEvents?.shipday?.pickup_id?.toString()
    : order.trackingEvents?.shipday?.delivery_id?.toString();
  
  if (!targetId) return null;
  
  const completedEvent = order.trackingEvents?.shipday?.updates?.find(
    (update: any) => update.event === 'ORDER_COMPLETED' && 
    update.orderId?.toString() === targetId
  );
  
  return completedEvent?.driverName || null;
};