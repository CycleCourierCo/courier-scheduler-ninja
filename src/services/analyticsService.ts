
import { supabase } from "@/integrations/supabase/client";
import { Order } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";

// Fetch all orders for analytics with pagination to avoid 1000 record limit
export const fetchOrdersForAnalytics = async (): Promise<Order[]> => {
  try {
    const allOrders = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("orders")
        .select("*, profiles(role, company_name, is_business)")
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error("Error fetching orders for analytics:", error);
        throw new Error("Failed to fetch orders for analytics");
      }

      if (data && data.length > 0) {
        allOrders.push(...data);
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    return allOrders.map((order) => ({
      ...mapDbOrderToOrderType(order),
      // @ts-ignore - Add additional properties from the join
      userRole: order.profiles?.role || "unknown",
      // @ts-ignore
      companyName: order.profiles?.company_name || null,
      // @ts-ignore
      isBusiness: order.profiles?.is_business || false,
    }));
  } catch (error) {
    console.error("Unexpected error in fetchOrdersForAnalytics:", error);
    throw error;
  }
};

// Types for analytics data
export type OrderCountByStatus = {
  status: string;
  count: number;
};

export type OrderCountByTime = {
  date: string;
  count: number;
};

export type CustomerOrderCount = {
  customerName: string;
  count: number;
  isB2B: boolean;
};

export type BikeAnalytics = {
  brand: string;
  count: number;
  percentage: number;
};

// Transform orders to analytics data
export const getOrderStatusAnalytics = (orders: Order[]): OrderCountByStatus[] => {
  const statusCounts: Record<string, number> = {};
  
  orders.forEach(order => {
    statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
  });
  
  return Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count
  }));
};

export const getOrderTimeAnalytics = (orders: Order[]): OrderCountByTime[] => {
  const weekCountMap: Record<string, number> = {};
  
  orders.forEach(order => {
    // Get the start of the week (Monday) for each order
    const orderDate = new Date(order.createdAt);
    const dayOfWeek = orderDate.getDay();
    const diff = orderDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Monday start
    const weekStart = new Date(orderDate.setDate(diff));
    const weekKey = weekStart.toISOString().split('T')[0];
    weekCountMap[weekKey] = (weekCountMap[weekKey] || 0) + 1;
  });
  
  return Object.entries(weekCountMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const getCustomerTypeAnalytics = (orders: Order[]) => {
  let b2bCount = 0;
  let b2cCount = 0;
  
  orders.forEach(order => {
    // @ts-ignore - Added in fetchOrdersForAnalytics
    if (order.isBusiness || order.userRole === 'b2b_customer') {
      b2bCount++;
    } else {
      b2cCount++;
    }
  });
  
  return [
    { name: 'B2B Customers', value: b2bCount },
    { name: 'B2C Customers', value: b2cCount }
  ];
};

export const getTopCustomersAnalytics = (orders: Order[]): CustomerOrderCount[] => {
  const customerCounts: Record<string, { count: number; isB2B: boolean }> = {};
  
  orders.forEach(order => {
    // @ts-ignore - Added in fetchOrdersForAnalytics
    const customerName = order.companyName || order.sender.name;
    // @ts-ignore - Added in fetchOrdersForAnalytics
    const isB2B = order.isBusiness || order.userRole === 'b2b_customer';
    
    if (!customerCounts[customerName]) {
      customerCounts[customerName] = { count: 0, isB2B };
    }
    customerCounts[customerName].count++;
  });
  
  return Object.entries(customerCounts)
    .map(([customerName, { count, isB2B }]) => ({ 
      customerName, 
      count, 
      isB2B 
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
};

export const getPartExchangeAnalytics = (orders: Order[]) => {
  const partExchangeCount = orders.filter(order => order.isBikeSwap).length;
  const normalCount = orders.length - partExchangeCount;
  
  return [
    { name: 'Part Exchange', value: partExchangeCount },
    { name: 'Normal Orders', value: normalCount }
  ];
};

export const getPaymentRequiredAnalytics = (orders: Order[]) => {
  const paymentRequiredCount = orders.filter(order => order.needsPaymentOnCollection).length;
  const noPaymentCount = orders.length - paymentRequiredCount;
  
  return [
    { name: 'Payment Required', value: paymentRequiredCount },
    { name: 'No Payment Required', value: noPaymentCount }
  ];
};

export const getBikeBrandAnalytics = (orders: Order[]): BikeAnalytics[] => {
  const brandCounts: Record<string, number> = {};
  let totalBikes = 0;
  
  orders.forEach(order => {
    if (order.bikeBrand) {
      const brand = order.bikeBrand.trim() || 'Unknown';
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
      totalBikes++;
    }
  });
  
  return Object.entries(brandCounts)
    .map(([brand, count]) => ({
      brand,
      count,
      percentage: totalBikes > 0 ? (count / totalBikes) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count);
};

// Types for timing analytics
export type CollectionTimeAnalytics = {
  averageTimeToCollect: number; // hours
  collectionSLA: number; // percentage within 24h
  byCustomer: Array<{ customer: string; avgTime: number }>;
};

export type DeliveryTimeAnalytics = {
  averageCollectionToDelivery: number; // hours
  averageTotalDuration: number; // hours from creation to delivery
  deliverySLA: number; // percentage within target
  byCustomer: Array<{ customer: string; avgCollectionToDelivery: number; avgTotal: number }>;
};

export type StorageAnalytics = {
  currentInStorage: number;
  averageDaysInStorage: number;
  longestStoredBikes: Array<{ orderId: string; customerName: string; daysInStorage: number }>;
  storageDistribution: Array<{ range: string; count: number }>;
};

// Helper function to extract collection timestamp from tracking events
const getCollectionTimestamp = (order: Order): Date | null => {
  if (!order.trackingEvents?.shipday?.updates) return null;
  
  // Look for collection events - ORDER_POD_UPLOAD for pickup or various pickup statuses
  const collectedEvent = order.trackingEvents.shipday.updates.find(
    (update: any) => 
      update.event === 'ORDER_POD_UPLOAD' && 
      (update.orderId === (order as any).shipdayPickupId || 
       update.description?.toLowerCase().includes('collected') ||
       update.description?.toLowerCase().includes('collect'))
  );
  
  return collectedEvent ? new Date(collectedEvent.timestamp) : null;
};

// Helper function to extract delivery timestamp from tracking events
const getDeliveryTimestamp = (order: Order): Date | null => {
  if (!order.trackingEvents?.shipday?.updates) return null;
  
  // Look for delivery events - ORDER_POD_UPLOAD for delivery
  const deliveredEvent = order.trackingEvents.shipday.updates.find(
    (update: any) => 
      update.event === 'ORDER_POD_UPLOAD' && 
      (update.orderId === (order as any).shipdayDeliveryId || 
       update.description?.toLowerCase().includes('delivered') ||
       update.description?.toLowerCase().includes('deliver'))
  );
  
  return deliveredEvent ? new Date(deliveredEvent.timestamp) : null;
};

// Calculate time to collection (order creation to collection)
export const getCollectionTimeAnalytics = (orders: Order[]): CollectionTimeAnalytics => {
  const collectedOrders = orders.filter(order => {
    const collectionTime = getCollectionTimestamp(order);
    return collectionTime !== null;
  });

  if (collectedOrders.length === 0) {
    return {
      averageTimeToCollect: 0,
      collectionSLA: 0,
      byCustomer: []
    };
  }

  let totalHours = 0;
  let within24h = 0;
  const customerData: Record<string, { totalHours: number; count: number }> = {};

  collectedOrders.forEach(order => {
    const collectionTime = getCollectionTimestamp(order);
    if (!collectionTime) return;

    const createdAt = new Date(order.createdAt);
    const hoursToCollect = (collectionTime.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    
    totalHours += hoursToCollect;
    if (hoursToCollect <= 24) within24h++;

    // @ts-ignore - Added in fetchOrdersForAnalytics
    const customerName = order.companyName || order.sender.name;
    if (!customerData[customerName]) {
      customerData[customerName] = { totalHours: 0, count: 0 };
    }
    customerData[customerName].totalHours += hoursToCollect;
    customerData[customerName].count++;
  });

  const byCustomer = Object.entries(customerData)
    .map(([customer, data]) => ({
      customer,
      avgTime: data.totalHours / data.count
    }))
    .sort((a, b) => b.avgTime - a.avgTime)
    .slice(0, 10);

  return {
    averageTimeToCollect: totalHours / collectedOrders.length,
    collectionSLA: (within24h / collectedOrders.length) * 100,
    byCustomer
  };
};

// Calculate delivery timing (collection to delivery, and total duration)
export const getDeliveryTimeAnalytics = (orders: Order[]): DeliveryTimeAnalytics => {
  const deliveredOrders = orders.filter(order => {
    const deliveryTime = getDeliveryTimestamp(order);
    const collectionTime = getCollectionTimestamp(order);
    return deliveryTime !== null && collectionTime !== null;
  });

  if (deliveredOrders.length === 0) {
    return {
      averageCollectionToDelivery: 0,
      averageTotalDuration: 0,
      deliverySLA: 0,
      byCustomer: []
    };
  }

  let totalCollectionToDeliveryHours = 0;
  let totalDurationHours = 0;
  let within48h = 0;
  const customerData: Record<string, { collectionToDelivery: number; totalDuration: number; count: number }> = {};

  deliveredOrders.forEach(order => {
    const collectionTime = getCollectionTimestamp(order);
    const deliveryTime = getDeliveryTimestamp(order);
    if (!collectionTime || !deliveryTime) return;

    const createdAt = new Date(order.createdAt);
    const collectionToDeliveryHours = (deliveryTime.getTime() - collectionTime.getTime()) / (1000 * 60 * 60);
    const totalHours = (deliveryTime.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    
    totalCollectionToDeliveryHours += collectionToDeliveryHours;
    totalDurationHours += totalHours;
    if (collectionToDeliveryHours <= 48) within48h++;

    // @ts-ignore - Added in fetchOrdersForAnalytics
    const customerName = order.companyName || order.sender.name;
    if (!customerData[customerName]) {
      customerData[customerName] = { collectionToDelivery: 0, totalDuration: 0, count: 0 };
    }
    customerData[customerName].collectionToDelivery += collectionToDeliveryHours;
    customerData[customerName].totalDuration += totalHours;
    customerData[customerName].count++;
  });

  const byCustomer = Object.entries(customerData)
    .map(([customer, data]) => ({
      customer,
      avgCollectionToDelivery: data.collectionToDelivery / data.count,
      avgTotal: data.totalDuration / data.count
    }))
    .sort((a, b) => b.avgCollectionToDelivery - a.avgCollectionToDelivery)
    .slice(0, 10);

  return {
    averageCollectionToDelivery: totalCollectionToDeliveryHours / deliveredOrders.length,
    averageTotalDuration: totalDurationHours / deliveredOrders.length,
    deliverySLA: (within48h / deliveredOrders.length) * 100,
    byCustomer
  };
};

// Calculate storage analytics
export const getStorageAnalytics = (orders: Order[]): StorageAnalytics => {
  const storedOrders = orders.filter(order => {
    return order.storage_locations && Array.isArray(order.storage_locations) && order.storage_locations.length > 0;
  });

  const currentInStorage = storedOrders.filter(order => 
    order.status !== 'delivered' && order.status !== 'cancelled'
  ).length;

  if (storedOrders.length === 0) {
    return {
      currentInStorage,
      averageDaysInStorage: 0,
      longestStoredBikes: [],
      storageDistribution: []
    };
  }

  let totalDays = 0;
  const storageDistribution: Record<string, number> = {
    '0-1 days': 0,
    '1-3 days': 0,
    '3-7 days': 0,
    '7-14 days': 0,
    '14+ days': 0
  };

  const bikesWithStorage = storedOrders.map(order => {
    const collectionTime = getCollectionTimestamp(order);
    const deliveryTime = getDeliveryTimestamp(order);
    
    let daysInStorage = 0;
    if (collectionTime) {
      const endTime = deliveryTime || new Date();
      daysInStorage = (endTime.getTime() - collectionTime.getTime()) / (1000 * 60 * 60 * 24);
      totalDays += daysInStorage;

      // Distribution
      if (daysInStorage <= 1) storageDistribution['0-1 days']++;
      else if (daysInStorage <= 3) storageDistribution['1-3 days']++;
      else if (daysInStorage <= 7) storageDistribution['3-7 days']++;
      else if (daysInStorage <= 14) storageDistribution['7-14 days']++;
      else storageDistribution['14+ days']++;
    }

    return {
      orderId: order.trackingNumber || order.id,
      // @ts-ignore - Added in fetchOrdersForAnalytics
      customerName: order.companyName || order.sender.name,
      daysInStorage
    };
  }).filter(item => item.daysInStorage > 0);

  const longestStoredBikes = bikesWithStorage
    .sort((a, b) => b.daysInStorage - a.daysInStorage)
    .slice(0, 10);

  return {
    currentInStorage,
    averageDaysInStorage: bikesWithStorage.length > 0 ? totalDays / bikesWithStorage.length : 0,
    longestStoredBikes,
    storageDistribution: Object.entries(storageDistribution).map(([range, count]) => ({ range, count }))
  };
};
