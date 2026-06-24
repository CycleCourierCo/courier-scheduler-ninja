
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

const _formatISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const _startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const _startOfISOWeek = (d: Date): Date => {
  const x = _startOfDay(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  return x;
};

const _startOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), 1);

export const getOrderTimeAnalytics = (orders: Order[]): OrderCountByTime[] => {
  const weekCountMap: Record<string, number> = {};

  orders.forEach(order => {
    const orderDate = new Date(order.createdAt);
    if (isNaN(orderDate.getTime())) return;
    const weekKey = _formatISODate(_startOfISOWeek(orderDate));
    weekCountMap[weekKey] = (weekCountMap[weekKey] || 0) + 1;
  });

  return Object.entries(weekCountMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

// =========================================================
// Time-series analytics with date-range + granularity filters
// =========================================================

export type Granularity = "day" | "week" | "month";

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface CreatedSeriesPoint {
  bucket: string;
  label: string;
  count: number;
}

export interface CompletedSeriesPoint {
  bucket: string;
  label: string;
  orders: number;
  collections: number;
  deliveries: number;
}

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const bucketStart = (d: Date, g: Granularity): Date => {
  if (g === "day") return _startOfDay(d);
  if (g === "week") return _startOfISOWeek(d);
  return _startOfMonth(d);
};

const bucketKey = (d: Date, g: Granularity): string => {
  const s = bucketStart(d, g);
  if (g === "month") return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}`;
  return _formatISODate(s);
};

const bucketLabel = (d: Date, g: Granularity): string => {
  const s = bucketStart(d, g);
  if (g === "day") return `${s.getDate()} ${MONTH_SHORT[s.getMonth()]}`;
  if (g === "week") {
    const end = new Date(s);
    end.setDate(end.getDate() + 6);
    return `${s.getDate()} ${MONTH_SHORT[s.getMonth()]} – ${end.getDate()} ${MONTH_SHORT[end.getMonth()]}`;
  }
  return `${MONTH_SHORT[s.getMonth()]} ${String(s.getFullYear()).slice(-2)}`;
};

const enumerateBuckets = (range: TimeRange, g: Granularity): Date[] => {
  const out: Date[] = [];
  const cursor = bucketStart(range.start, g);
  const endBucket = bucketStart(range.end, g);
  let guard = 0;
  while (cursor.getTime() <= endBucket.getTime() && guard < 5000) {
    out.push(new Date(cursor));
    if (g === "day") cursor.setDate(cursor.getDate() + 1);
    else if (g === "week") cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
    guard++;
  }
  return out;
};

const inRange = (d: Date, range: TimeRange): boolean => {
  const t = d.getTime();
  const startT = _startOfDay(range.start).getTime();
  const endT = new Date(range.end).setHours(23, 59, 59, 999);
  return t >= startT && t <= endT;
};

export const getOrdersCreatedSeries = (
  orders: Order[],
  range: TimeRange,
  g: Granularity,
): CreatedSeriesPoint[] => {
  const buckets = enumerateBuckets(range, g);
  const counts: Record<string, number> = {};
  for (const b of buckets) counts[bucketKey(b, g)] = 0;

  for (const order of orders) {
    const d = new Date(order.createdAt);
    if (isNaN(d.getTime())) continue;
    if (!inRange(d, range)) continue;
    const key = bucketKey(d, g);
    if (key in counts) counts[key] += 1;
  }

  return buckets.map(b => ({
    bucket: bucketKey(b, g),
    label: bucketLabel(b, g),
    count: counts[bucketKey(b, g)] || 0,
  }));
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

export const getAllCustomersAnalytics = (orders: Order[]): CustomerOrderCount[] => {
  const customerCounts: Record<string, { count: number; isB2B: boolean }> = {};

  orders.forEach(order => {
    // @ts-ignore
    const customerName = order.companyName || order.sender.name;
    // @ts-ignore
    const isB2B = order.isBusiness || order.userRole === 'b2b_customer';
    if (!customerName) return;
    if (!customerCounts[customerName]) {
      customerCounts[customerName] = { count: 0, isB2B };
    }
    customerCounts[customerName].count++;
  });

  return Object.entries(customerCounts)
    .map(([customerName, { count, isB2B }]) => ({ customerName, count, isB2B }))
    .sort((a, b) => b.count - a.count);
};

export const getCustomerOrdersOverTime = (
  orders: Order[],
  customerName: string
): { month: string; count: number }[] => {
  const monthMap: Record<string, number> = {};

  orders.forEach(order => {
    // @ts-ignore
    const name = order.companyName || order.sender.name;
    if (name !== customerName) return;
    const d = new Date(order.createdAt);
    if (isNaN(d.getTime())) return;
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap[monthKey] = (monthMap[monthKey] || 0) + 1;
  });

  return Object.entries(monthMap)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

export const getCustomerOrdersOverTimeRanged = (
  orders: Order[],
  customerName: string,
  range: TimeRange,
  g: Granularity,
): CreatedSeriesPoint[] => {
  const buckets = enumerateBuckets(range, g);
  const counts: Record<string, number> = {};
  for (const b of buckets) counts[bucketKey(b, g)] = 0;

  for (const order of orders) {
    // @ts-ignore
    const name = order.companyName || order.sender?.name;
    if (name !== customerName) continue;
    const d = new Date(order.createdAt);
    if (isNaN(d.getTime())) continue;
    if (!inRange(d, range)) continue;
    const key = bucketKey(d, g);
    if (key in counts) counts[key] += 1;
  }

  return buckets.map(b => ({
    bucket: bucketKey(b, g),
    label: bucketLabel(b, g),
    count: counts[bucketKey(b, g)] || 0,
  }));
};

export const getCustomerEarliestOrderDate = (
  orders: Order[],
  customerName: string,
): Date | null => {
  let earliest: number | null = null;
  for (const order of orders) {
    // @ts-ignore
    const name = order.companyName || order.sender?.name;
    if (name !== customerName) continue;
    const t = new Date(order.createdAt).getTime();
    if (isNaN(t)) continue;
    if (earliest === null || t < earliest) earliest = t;
  }
  return earliest === null ? null : new Date(earliest);
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

// Helper function to extract collection timestamp from tracking events.
// Shipday emits ORDER_COMPLETED with a "collected" description on pickup completion.
// We fall back to ORDER_POD_UPLOAD or ORDER_PIKEDUP for older/edge cases.
const COLLECTION_EVENTS = new Set(['ORDER_COMPLETED', 'ORDER_POD_UPLOAD', 'ORDER_PIKEDUP']);
const DELIVERY_EVENTS = new Set(['ORDER_COMPLETED', 'ORDER_POD_UPLOAD']);

const isCollectionDescription = (desc?: string): boolean => {
  if (!desc) return false;
  const d = desc.toLowerCase();
  return d.includes('collect') || d.includes('picked up') || d.includes('pickup');
};

const isDeliveryDescription = (desc?: string): boolean => {
  if (!desc) return false;
  const d = desc.toLowerCase();
  return d.includes('deliver');
};

const getCollectionTimestamp = (order: Order): Date | null => {
  // Source of truth: backend-recorded confirmation timestamp.
  if (order.collectionConfirmationSentAt) {
    const d = new Date(order.collectionConfirmationSentAt);
    if (!isNaN(d.getTime())) return d;
  }

  const updates = order.trackingEvents?.shipday?.updates;
  if (!updates || updates.length === 0) return null;

  const pickupId = order.trackingEvents?.shipday?.pickup_id;
  const matches = updates
    .filter((u: any) =>
      COLLECTION_EVENTS.has(u.event) &&
      (
        (pickupId && String(u.orderId) === String(pickupId)) ||
        isCollectionDescription(u.description)
      )
    )
    .map((u: any) => new Date(u.timestamp).getTime())
    .filter((t: number) => !isNaN(t));

  if (matches.length === 0) return null;
  return new Date(Math.min(...matches));
};

const getDeliveryTimestamp = (order: Order): Date | null => {
  if (order.deliveryConfirmationSentAt) {
    const d = new Date(order.deliveryConfirmationSentAt);
    if (!isNaN(d.getTime())) return d;
  }

  const updates = order.trackingEvents?.shipday?.updates;
  if (!updates || updates.length === 0) return null;

  const deliveryId = order.trackingEvents?.shipday?.delivery_id;
  const matches = updates
    .filter((u: any) =>
      DELIVERY_EVENTS.has(u.event) &&
      (
        (deliveryId && String(u.orderId) === String(deliveryId)) ||
        isDeliveryDescription(u.description)
      )
    )
    .map((u: any) => new Date(u.timestamp).getTime())
    .filter((t: number) => !isNaN(t));

  if (matches.length === 0) return null;
  return new Date(Math.max(...matches));
};

// Calculate time to collection (order creation to collection)
export const getCollectionTimeAnalytics = (orders: Order[], range?: TimeRange): CollectionTimeAnalytics => {
  const scoped = range ? orders.filter(o => inRange(new Date(o.createdAt), range)) : orders;
  const collectedOrders = scoped.filter(order => {
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
export const getDeliveryTimeAnalytics = (orders: Order[], range?: TimeRange): DeliveryTimeAnalytics => {
  const scoped = range ? orders.filter(o => inRange(new Date(o.createdAt), range)) : orders;
  const deliveredOrders = scoped.filter(order => {
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
export const getStorageAnalytics = (orders: Order[], range?: TimeRange): StorageAnalytics => {
  const scoped = range ? orders.filter(o => inRange(new Date(o.createdAt), range)) : orders;
  const storedOrders = scoped.filter(order => {
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

export const getOrdersCompletedSeries = (
  orders: Order[],
  range: TimeRange,
  g: Granularity,
): CompletedSeriesPoint[] => {
  const buckets = enumerateBuckets(range, g);
  const data: Record<string, { orders: number; collections: number; deliveries: number }> = {};
  for (const b of buckets) data[bucketKey(b, g)] = { orders: 0, collections: 0, deliveries: 0 };

  for (const order of orders) {
    const coll = getCollectionTimestamp(order);
    const del = getDeliveryTimestamp(order);

    if (coll && inRange(coll, range)) {
      const k = bucketKey(coll, g);
      if (k in data) data[k].collections += 1;
    }
    if (del && inRange(del, range)) {
      const k = bucketKey(del, g);
      if (k in data) {
        data[k].deliveries += 1;
        if (coll) data[k].orders += 1;
      }
    }
  }

  return buckets.map(b => {
    const k = bucketKey(b, g);
    return { bucket: k, label: bucketLabel(b, g), ...data[k] };
  });
};
