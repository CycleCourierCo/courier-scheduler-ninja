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
    (update: any) => (
      update.event === 'ORDER_ASSIGNED' || 
      update.event === 'ORDER_ACCEPTED_AND_STARTED'
    ) && 
    update.orderId?.toString() === targetId &&
    update.driverName
  );
  
  if (!assignmentEvents?.length) return null;
  
  // Sort by timestamp to get chronological order, then prioritize ORDER_ASSIGNED over ORDER_ACCEPTED_AND_STARTED
  const sortedEvents = assignmentEvents.sort((a: any, b: any) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    
    // If same timestamp, prioritize ORDER_ASSIGNED
    if (timeA === timeB) {
      if (a.event === 'ORDER_ASSIGNED' && b.event === 'ORDER_ACCEPTED_AND_STARTED') return 1;
      if (a.event === 'ORDER_ACCEPTED_AND_STARTED' && b.event === 'ORDER_ASSIGNED') return -1;
    }
    
    return timeA - timeB;
  });
  
  // Get the most recent assignment event
  const latestEvent = sortedEvents[sortedEvents.length - 1];
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