import { supabase } from "@/integrations/supabase/client";
import { Timeslip } from "@/types/timeslip";
import { 
  startOfWeek, 
  endOfWeek, 
  format, 
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachWeekOfInterval,
  eachMonthOfInterval,
  addDays
} from "date-fns";

export interface ProfitabilityMetrics {
  revenue: number;
  totalCosts: number;
  profit: number;
  customAddonCosts: number;
}

export interface DailyProfitability {
  date: string;
  formattedDate: string;
  revenue: number;
  costs: number;
  profit: number;
}

export interface WeeklyProfitabilityData {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  formattedLabel: string;
  revenue: number;
  costs: number;
  profit: number;
}

export interface MonthlyProfitabilityData {
  month: number;
  year: number;
  formattedLabel: string;
  revenue: number;
  costs: number;
  profit: number;
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

export const getCurrentWeekRange = () => {
  const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 }); // Monday = 1
  const sunday = endOfWeek(now, { weekStartsOn: 1 });
  
  return { monday, sunday };
};

export const getTimeslipsForWeek = async (startDate: string, endDate: string): Promise<Timeslip[]> => {
  const { data, error } = await supabase
    .from('timeslips')
    .select(`
      *,
      driver:profiles!timeslips_driver_id_fkey(*)
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching week timeslips:', error);
    throw error;
  }

  return (data as unknown as Timeslip[]) || [];
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
  
  // Fetch all orders and filter in JavaScript
  const { data, error } = await supabase
    .from('orders')
    .select('id, bike_quantity, collection_driver_name, delivery_driver_name, scheduled_pickup_date, scheduled_delivery_date');

  if (error || !data) {
    console.error('❌ Error fetching orders for driver/date:', error);
    return 0;
  }

  console.log('📦 Raw orders from Supabase:', data.length);

  // Filter by date in JavaScript (extract date part from timestamp)
  const dateFilteredData = data.filter(order => {
    const pickupDate = order.scheduled_pickup_date?.split('T')[0];
    const deliveryDate = order.scheduled_delivery_date?.split('T')[0];
    return pickupDate === date || deliveryDate === date;
  });

  console.log('📅 Orders matching date:', dateFilteredData.length);

  // Filter by driver name in JavaScript to ensure AND logic
  const filteredData = dateFilteredData.filter(order => 
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

export const calculateDailyProfitability = async (
  timeslips: Timeslip[],
  startDate: Date,
  endDate: Date,
  revenuePerStop: number,
  costPerMile: number
): Promise<DailyProfitability[]> => {
  // Generate all days in the range (Monday to Sunday)
  const daysInWeek = eachDayOfInterval({ start: startDate, end: endDate });
  
  // Group timeslips by date
  const timeslipsByDate = timeslips.reduce((acc, timeslip) => {
    if (!acc[timeslip.date]) {
      acc[timeslip.date] = [];
    }
    acc[timeslip.date].push(timeslip);
    return acc;
  }, {} as Record<string, Timeslip[]>);

  // Calculate metrics for each day
  const dailyData: DailyProfitability[] = [];

  for (const day of daysInWeek) {
    const dateString = format(day, 'yyyy-MM-dd');
    const dayTimeslips = timeslipsByDate[dateString] || [];
    
    let dayRevenue = 0;
    let dayCosts = 0;
    
    // Calculate for each timeslip on this day
    for (const timeslip of dayTimeslips) {
      const totalJobs = await getTotalJobs(timeslip);
      const metrics = calculateProfitability(totalJobs, timeslip, revenuePerStop, costPerMile);
      dayRevenue += metrics.revenue;
      dayCosts += metrics.totalCosts;
    }

    dailyData.push({
      date: dateString,
      formattedDate: format(day, 'EEE, MMM d'),
      revenue: dayRevenue,
      costs: dayCosts,
      profit: dayRevenue - dayCosts,
    });
  }

  return dailyData;
};

// Get timeslips for an entire month
export const getTimeslipsForMonth = async (year: number, month: number): Promise<Timeslip[]> => {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(monthStart);
  
  const startString = format(monthStart, 'yyyy-MM-dd');
  const endString = format(monthEnd, 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('timeslips')
    .select(`
      *,
      driver:profiles!timeslips_driver_id_fkey(*)
    `)
    .gte('date', startString)
    .lte('date', endString)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching month timeslips:', error);
    throw error;
  }

  return (data as unknown as Timeslip[]) || [];
};

// Get timeslips for an entire year
export const getTimeslipsForYear = async (year: number): Promise<Timeslip[]> => {
  const yearStart = startOfYear(new Date(year, 0));
  const yearEnd = endOfYear(yearStart);
  
  const startString = format(yearStart, 'yyyy-MM-dd');
  const endString = format(yearEnd, 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('timeslips')
    .select(`
      *,
      driver:profiles!timeslips_driver_id_fkey(*)
    `)
    .gte('date', startString)
    .lte('date', endString)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching year timeslips:', error);
    throw error;
  }

  return (data as unknown as Timeslip[]) || [];
};

// Calculate weekly profitability for a month (returns 4-5 weeks)
export const calculateWeeklyProfitabilityForMonth = async (
  timeslips: Timeslip[],
  year: number,
  month: number,
  revenuePerStop: number,
  costPerMile: number
): Promise<WeeklyProfitabilityData[]> => {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(monthStart);
  
  // Get all weeks that overlap with this month
  const weeksInMonth = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    { weekStartsOn: 1 } // Monday
  );

  // Group timeslips by date for quick lookup
  const timeslipsByDate = timeslips.reduce((acc, timeslip) => {
    if (!acc[timeslip.date]) {
      acc[timeslip.date] = [];
    }
    acc[timeslip.date].push(timeslip);
    return acc;
  }, {} as Record<string, Timeslip[]>);

  const weeklyData: WeeklyProfitabilityData[] = [];

  for (let i = 0; i < weeksInMonth.length; i++) {
    const weekStart = weeksInMonth[i];
    const weekEnd = addDays(weekStart, 6);
    
    // Clamp to month boundaries for display
    const displayStart = weekStart < monthStart ? monthStart : weekStart;
    const displayEnd = weekEnd > monthEnd ? monthEnd : weekEnd;
    
    // Get all days in this week
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    let weekRevenue = 0;
    let weekCosts = 0;

    // Calculate metrics for each day
    for (const day of daysInWeek) {
      const dateString = format(day, 'yyyy-MM-dd');
      const dayTimeslips = timeslipsByDate[dateString] || [];
      
      for (const timeslip of dayTimeslips) {
        const totalJobs = await getTotalJobs(timeslip);
        const metrics = calculateProfitability(totalJobs, timeslip, revenuePerStop, costPerMile);
        weekRevenue += metrics.revenue;
        weekCosts += metrics.totalCosts;
      }
    }

    weeklyData.push({
      weekNumber: i + 1,
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(weekEnd, 'yyyy-MM-dd'),
      formattedLabel: `${format(displayStart, 'MMM d')} - ${format(displayEnd, 'd')}`,
      revenue: weekRevenue,
      costs: weekCosts,
      profit: weekRevenue - weekCosts,
    });
  }

  return weeklyData;
};

// Calculate monthly profitability for a year (returns 12 months)
export const calculateMonthlyProfitabilityForYear = async (
  timeslips: Timeslip[],
  year: number,
  revenuePerStop: number,
  costPerMile: number
): Promise<MonthlyProfitabilityData[]> => {
  const yearStart = startOfYear(new Date(year, 0));
  const yearEnd = endOfYear(yearStart);
  
  const monthsInYear = eachMonthOfInterval({ start: yearStart, end: yearEnd });

  // Group timeslips by month for quick lookup
  const timeslipsByMonth = timeslips.reduce((acc, timeslip) => {
    const month = timeslip.date.substring(0, 7); // 'yyyy-MM'
    if (!acc[month]) {
      acc[month] = [];
    }
    acc[month].push(timeslip);
    return acc;
  }, {} as Record<string, Timeslip[]>);

  const monthlyData: MonthlyProfitabilityData[] = [];

  for (const monthDate of monthsInYear) {
    const monthKey = format(monthDate, 'yyyy-MM');
    const monthTimeslips = timeslipsByMonth[monthKey] || [];
    
    let monthRevenue = 0;
    let monthCosts = 0;

    for (const timeslip of monthTimeslips) {
      const totalJobs = await getTotalJobs(timeslip);
      const metrics = calculateProfitability(totalJobs, timeslip, revenuePerStop, costPerMile);
      monthRevenue += metrics.revenue;
      monthCosts += metrics.totalCosts;
    }

    monthlyData.push({
      month: monthDate.getMonth(),
      year: year,
      formattedLabel: format(monthDate, 'MMM'),
      revenue: monthRevenue,
      costs: monthCosts,
      profit: monthRevenue - monthCosts,
    });
  }

  return monthlyData;
};
