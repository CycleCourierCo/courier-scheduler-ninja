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

export const calculateProfitability = (
  timeslip: Timeslip,
  revenuePerStop: number,
  costPerMile: number
): ProfitabilityMetrics => {
  // Calculate revenue based on stops
  const revenue = timeslip.total_stops * revenuePerStop;

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

export const aggregateProfitability = (
  timeslips: Timeslip[],
  revenuePerStop: number,
  costPerMile: number
) => {
  let totalRevenue = 0;
  let totalCosts = 0;
  let totalProfit = 0;

  timeslips.forEach(timeslip => {
    const metrics = calculateProfitability(timeslip, revenuePerStop, costPerMile);
    totalRevenue += metrics.revenue;
    totalCosts += metrics.totalCosts;
    totalProfit += metrics.profit;
  });

  return {
    totalRevenue,
    totalCosts,
    totalProfit,
    driverCount: timeslips.length,
  };
};
