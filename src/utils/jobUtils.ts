import { OrderData } from "@/pages/JobScheduling";

// Determine which jobs are needed based on order status
export const getJobsForOrder = (order: OrderData): ('collection' | 'delivery')[] => {
  const status = order.status;
  
  // Already completed or cancelled - no jobs
  if (['delivered', 'cancelled'].includes(status)) return [];
  
  // Collection already done - only delivery
  if (['collected', 'driver_to_delivery', 'delivery_scheduled'].includes(status)) {
    return ['delivery'];
  }
  
  // Collection scheduled but not done - only collection for now
  if (status === 'collection_scheduled') {
    return ['collection'];
  }
  
  // All other statuses - both jobs needed
  return ['collection', 'delivery'];
};

// Count jobs for a set of orders - used for consistent job counting across UI
export const countJobsForOrders = (orders: OrderData[]): { 
  total: number; 
  collections: number; 
  deliveries: number 
} => {
  let collections = 0;
  let deliveries = 0;
  
  orders.forEach(order => {
    const jobs = getJobsForOrder(order);
    if (jobs.includes('collection')) collections++;
    if (jobs.includes('delivery')) deliveries++;
  });
  
  return { total: collections + deliveries, collections, deliveries };
};
