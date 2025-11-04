import { supabase } from "@/integrations/supabase/client";
import { Timeslip } from "@/types/timeslip";

export interface ProfitabilityMetrics {
  revenue: number;
  totalCosts: number;
  profit: number;
  customAddonCosts: number;
}

export const getTimeslipsForDate = async (date: string): Promise<Timeslip[]> => {
  const { data, error } = await supabase
    .from('timeslips')
    .select(`
      *,
      driver:profiles!timeslips_driver_id_fkey(*)
    `)
    .eq('date', date)
    .order('driver_id');

  if (error) throw error;
  return (data as unknown as Timeslip[]) || [];
};

export const updateTimeslipMileage = async (id: string, mileage: number): Promise<void> => {
  const { error } = await supabase
    .from('timeslips')
    .update({ mileage })
    .eq('id', id);

  if (error) throw error;
};

// Calculate total jobs from order IDs (for historic timeslips without total_jobs)
export const calculateTotalJobsFromOrders = async (orderIds: string[]): Promise<number> => {
  if (orderIds.length === 0) return 0;

  const { data, error } = await supabase
    .from('orders')
    .select('bike_quantity')
    .in('id', orderIds);

  if (error || !data) {
    console.error('Error fetching orders for job calculation:', error);
    return 0;
  }

  return data.reduce((sum, order) => sum + (order.bike_quantity || 1), 0);
};

// Calculate total jobs by matching driver name + date in orders table (for historic timeslips)
export const calculateTotalJobsFromDriverDate = async (
  shipdayDriverName: string,
  date: string
): Promise<number> => {
  // First filter by date, then filter by driver in JavaScript for correct AND logic
  const { data, error } = await supabase
    .from('orders')
    .select('id, bike_quantity, collection_driver_name, delivery_driver_name, scheduled_pickup_date, scheduled_delivery_date')
    .or(`scheduled_pickup_date::date.eq.${date},scheduled_delivery_date::date.eq.${date}`);

  if (error || !data) {
    console.error('Error fetching orders for driver/date:', error);
    return 0;
  }

  // Filter by driver name in JavaScript to ensure AND logic
  const filteredData = data.filter(order => 
    order.collection_driver_name === shipdayDriverName || 
    order.delivery_driver_name === shipdayDriverName
  );

  // Get unique order IDs (avoid double-counting if driver does both pickup and delivery)
  const uniqueOrderIds = new Set(filteredData.map(order => order.id));
  
  // Sum bike_quantity for unique orders
  const uniqueOrders = Array.from(uniqueOrderIds).map(id => 
    filteredData.find(order => order.id === id)!
  );
  
  return uniqueOrders.reduce((sum, order) => sum + (order.bike_quantity || 1), 0);
};

// Get total jobs for a timeslip (hybrid: uses total_jobs if available, else calculates)
export const getTotalJobs = async (timeslip: Timeslip): Promise<number> => {
  // Use total_jobs if available (new timeslips)
  if (timeslip.total_jobs !== null && timeslip.total_jobs !== undefined) {
    return timeslip.total_jobs;
  }

  // Try driver name + date matching first (for historic timeslips)
  if (timeslip.driver?.shipday_driver_name && timeslip.date) {
    const jobsFromOrders = await calculateTotalJobsFromDriverDate(
      timeslip.driver.shipday_driver_name,
      timeslip.date
    );
    
    if (jobsFromOrders > 0) {
      return jobsFromOrders;
    }
  }

  // Fallback: Calculate from job_locations if order_ids exist
  const orderIds = (timeslip.job_locations || [])
    .map(loc => loc.order_id)
    .filter((id): id is string => !!id);

  if (orderIds.length > 0) {
    const uniqueOrderIds = [...new Set(orderIds)];
    return await calculateTotalJobsFromOrders(uniqueOrderIds);
  }

  return 0;
};

export const calculateProfitability = (
  totalJobs: number,
  timeslip: Timeslip,
  revenuePerStop: number,
  costPerMile: number
): ProfitabilityMetrics => {
  // Calculate revenue based on total jobs (bikes)
  const revenue = totalJobs * revenuePerStop;

  // Calculate custom addon costs
  const customAddonCosts = (timeslip.custom_addons || []).reduce((sum, addon) => {
    return sum + (addon.hours * timeslip.hourly_rate);
  }, 0);

  // Calculate mileage costs
  const mileageCosts = (timeslip.mileage || 0) * costPerMile;

  // Total costs = driver pay + mileage costs
  const totalCosts = (timeslip.total_pay || 0) + mileageCosts;

  // Profit = revenue - total costs
  const profit = revenue - totalCosts;

  return {
    revenue,
    totalCosts,
    profit,
    customAddonCosts,
  };
};

export const aggregateProfitability = async (
  timeslips: Timeslip[],
  revenuePerStop: number,
  costPerMile: number
) => {
  let totalRevenue = 0;
  let totalCosts = 0;
  let totalProfit = 0;

  for (const timeslip of timeslips) {
    const totalJobs = await getTotalJobs(timeslip);
    const metrics = calculateProfitability(totalJobs, timeslip, revenuePerStop, costPerMile);
    totalRevenue += metrics.revenue;
    totalCosts += metrics.totalCosts;
    totalProfit += metrics.profit;
  }

  return {
    totalRevenue,
    totalCosts,
    totalProfit,
    driverCount: timeslips.length,
  };
};
