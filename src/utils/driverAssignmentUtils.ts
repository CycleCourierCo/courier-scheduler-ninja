import { Order } from "@/types/order";

/**
 * Utility functions for handling driver assignments consistently across the application
 * Collection assignments should match pickup_id, delivery assignments should match delivery_id
 */

// Get the most recent driver assignment for pickup or delivery
export const getDriverAssignment = (order: Order, type: 'pickup' | 'delivery'): string | null => {
  const updates = order.trackingEvents?.shipday?.updates;
  if (!updates?.length) return null;

  // For pickup: look for pickup events (usually the first orderId in chronological order)
  // For delivery: look for delivery events (usually the second/different orderId, or events after pickup completion)
  if (type === 'pickup') {
    const targetId = order.trackingEvents?.shipday?.pickup_id?.toString();
    if (!targetId) return null;
    
    const assignmentEvents = updates.filter(
      (update: any) => (
        update.event === 'ORDER_ASSIGNED' || 
        update.event === 'ORDER_ACCEPTED_AND_STARTED'
      ) && 
      update.orderId?.toString() === targetId &&
      update.driverName
    );
    
    if (!assignmentEvents?.length) return null;
    
    // Sort by timestamp and prioritize ORDER_ASSIGNED
    const sortedEvents = assignmentEvents.sort((a: any, b: any) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      
      if (timeA === timeB) {
        if (a.event === 'ORDER_ASSIGNED' && b.event === 'ORDER_ACCEPTED_AND_STARTED') return 1;
        if (a.event === 'ORDER_ACCEPTED_AND_STARTED' && b.event === 'ORDER_ASSIGNED') return -1;
      }
      
      return timeA - timeB;
    });
    
    const latestEvent = sortedEvents[sortedEvents.length - 1];
    return latestEvent?.driverName || null;
  } else {
    // For delivery: look for delivery-related events
    // First try the stored delivery_id
    const targetId = order.trackingEvents?.shipday?.delivery_id?.toString();
    
    let assignmentEvents = targetId ? updates.filter(
      (update: any) => (
        update.event === 'ORDER_ASSIGNED' || 
        update.event === 'ORDER_ACCEPTED_AND_STARTED'
      ) && 
      update.orderId?.toString() === targetId &&
      update.driverName
    ) : [];
    
    // If no events found with stored delivery_id, look for any delivery events
    // (events that are not pickup events and contain "delivery" or come after pickup completion)
    if (!assignmentEvents?.length) {
      const pickupId = order.trackingEvents?.shipday?.pickup_id?.toString();
      
      assignmentEvents = updates.filter(
        (update: any) => {
          // Must be assignment/start event with driver name
          if (!(update.event === 'ORDER_ASSIGNED' || update.event === 'ORDER_ACCEPTED_AND_STARTED') || !update.driverName) {
            return false;
          }
          
          // If we have pickup ID, exclude pickup events
          if (pickupId && update.orderId?.toString() === pickupId) {
            return false;
          }
          
          // Include events that mention delivery or are likely delivery events
          return update.description?.toLowerCase().includes('delivery') || 
                 update.orderId?.toString() !== pickupId;
        }
      );
    }
    
    if (!assignmentEvents?.length) return null;
    
    // Sort by timestamp and prioritize ORDER_ASSIGNED
    const sortedEvents = assignmentEvents.sort((a: any, b: any) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      
      if (timeA === timeB) {
        if (a.event === 'ORDER_ASSIGNED' && b.event === 'ORDER_ACCEPTED_AND_STARTED') return 1;
        if (a.event === 'ORDER_ACCEPTED_AND_STARTED' && b.event === 'ORDER_ASSIGNED') return -1;
      }
      
      return timeA - timeB;
    });
    
    const latestEvent = sortedEvents[sortedEvents.length - 1];
    return latestEvent?.driverName || null;
  }
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