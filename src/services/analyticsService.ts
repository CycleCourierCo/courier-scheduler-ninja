
import { supabase } from "@/integrations/supabase/client";
import { Order } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";

// Fetch all orders for analytics
export const fetchOrdersForAnalytics = async (): Promise<Order[]> => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, profiles(role, company_name, is_business)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders for analytics:", error);
      throw new Error("Failed to fetch orders for analytics");
    }

    return data.map((order) => ({
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
  const dateCountMap: Record<string, number> = {};
  
  orders.forEach(order => {
    const date = new Date(order.createdAt).toISOString().split('T')[0];
    dateCountMap[date] = (dateCountMap[date] || 0) + 1;
  });
  
  return Object.entries(dateCountMap)
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
    const customerName = order.sender.name;
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
