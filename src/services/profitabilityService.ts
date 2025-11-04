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
  console.log('🔍 calculateTotalJobsFromDriverDate called:', { shipdayDriverName, date });
  
  // First filter by date, then filter by driver in JavaScript for correct AND logic
  const { data, error } = await supabase
    .from('orders')
    .select('id, bike_quantity, collection_driver_name, delivery_driver_name, scheduled_pickup_date, scheduled_delivery_date')
    .or(`scheduled_pickup_date::date.eq.${date},scheduled_delivery_date::date.eq.${date}`);

  if (error || !data) {
    console.error('❌ Error fetching orders for driver/date:', error);
    return 0;
  }

  console.log('📦 Raw orders from Supabase:', data.length);

  // Filter by driver name in JavaScript to ensure AND logic
  const filteredData = data.filter(order => 
    order.collection_driver_name === shipdayDriverName || 
    order.delivery_driver_name === shipdayDriverName
  );

  console.log('🔎 Filtered orders matching driver:', {
    filtered_count: filteredData.length,
    driver_searched: shipdayDriverName,
    sample_driver_names: data.slice(0, 3).map(o => ({ 
      collection: o.collection_driver_name, 
      delivery: o.delivery_driver_name 
    }))
  });

  // Get unique order IDs (avoid double-counting if driver does both pickup and delivery)
  const uniqueOrderIds = new Set(filteredData.map(order => order.id));
  
  // Sum bike_quantity for unique orders
  const uniqueOrders = Array.from(uniqueOrderIds).map(id => 
    filteredData.find(order => order.id === id)!
  );
  
  const totalJobs = uniqueOrders.reduce((sum, order) => sum + (order.bike_quantity || 1), 0);
  
  console.log('✅ Total jobs calculated:', {
    unique_orders: uniqueOrders.length,
    total_jobs: totalJobs,
    bike_quantities: uniqueOrders.map(o => o.bike_quantity)
  });
  
  return totalJobs;
};

// Get total jobs for a timeslip (hybrid: uses total_jobs if available, else calculates)
export const getTotalJobs = async (timeslip: Timeslip): Promise<number> => {
  console.log('🔍 getTotalJobs called for timeslip:', {
    id: timeslip.id,
    date: timeslip.date,
    total_jobs: timeslip.total_jobs,
    driver_name: timeslip.driver?.shipday_driver_name,
    has_driver_object: !!timeslip.driver
  });

  // Use total_jobs if available (new timeslips)
  if (timeslip.total_jobs !== null && timeslip.total_jobs !== undefined) {
    console.log('✅ Using total_jobs from database:', timeslip.total_jobs);
    return timeslip.total_jobs;
  }

  // Try driver name + date matching first (for historic timeslips)
  if (timeslip.driver?.shipday_driver_name && timeslip.date) {
    console.log('🔄 Calculating from driver name + date:', {
      driver: timeslip.driver.shipday_driver_name,
      date: timeslip.date
    });
    
    const jobsFromOrders = await calculateTotalJobsFromDriverDate(
      timeslip.driver.shipday_driver_name,
      timeslip.date
    );
    
    console.log('📊 Jobs calculated from driver/date:', jobsFromOrders);
    
    if (jobsFromOrders > 0) {
      return jobsFromOrders;
    }
  } else {
    console.log('⚠️ Missing driver name or date:', {
      has_driver_name: !!timeslip.driver?.shipday_driver_name,
      has_date: !!timeslip.date
    });
  }

  // Fallback: Calculate from job_locations if order_ids exist
  const orderIds = (timeslip.job_locations || [])
    .map(loc => loc.order_id)
    .filter((id): id is string => !!id);

  console.log('📍 Trying job_locations fallback:', {
    orderIds_count: orderIds.length
  });

  if (orderIds.length > 0) {
    const uniqueOrderIds = [...new Set(orderIds)];
    const result = await calculateTotalJobsFromOrders(uniqueOrderIds);
    console.log('📦 Jobs from order IDs:', result);
    return result;
  }

  console.log('❌ No jobs found, returning 0');
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
