import { supabase } from "@/integrations/supabase/client";
import { Timeslip } from "@/types/timeslip";
import { getRevenuePerStopForBikeType } from "@/constants/bikePricing";
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

// Only approved timeslips count towards profitability; drafts lack final mileage/pay.
const fetchApprovedTimeslips = async (startDate: string, endDate: string): Promise<Timeslip[]> => {
  const PAGE = 1000;
  const all: Timeslip[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('timeslips')
      .select(`*, driver:profiles!timeslips_driver_id_fkey(*)`)
      .eq('status', 'approved')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...((data as unknown as Timeslip[]) || []));
    if (!data || data.length < PAGE) break;
  }
  return all;
};

export const getDraftTimeslipCount = async (startDate: string, endDate: string): Promise<number> => {
  const { count, error } = await supabase
    .from('timeslips')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'draft')
    .gte('date', startDate)
    .lte('date', endDate);
  if (error) throw error;
  return count || 0;
};

export const getTimeslipsForDate = async (date: string): Promise<Timeslip[]> => fetchApprovedTimeslips(date, date);

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

export const getTimeslipsForWeek = async (startDate: string, endDate: string): Promise<Timeslip[]> =>
  fetchApprovedTimeslips(startDate, endDate);

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

// Helper: fetch orders for a specific date using two queries (pickup OR delivery) and merge
const ordersForDateMemo = new Map<string, { at: number; p: Promise<any[]> }>();
const fetchOrdersForDate = (date: string): Promise<any[]> => {
  const hit = ordersForDateMemo.get(date);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.p;
  const p = fetchOrdersForDateRaw(date).catch((e) => { ordersForDateMemo.delete(date); throw e; });
  ordersForDateMemo.set(date, { at: Date.now(), p });
  return p;
};

// Run async work over items with limited parallelism, preserving order
const mapLimit = async <T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
};

const fetchOrdersForDateRaw = async (date: string) => {
  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59.999`;

  const selectFields = 'id, bike_type, bike_quantity, bikes, user_id, use_large_bike_rate, collection_driver_name, delivery_driver_name, scheduled_pickup_date, scheduled_delivery_date' as const;

  const [pickupRes, deliveryRes] = await Promise.all([
    supabase
      .from('orders')
      .select(selectFields)
      .gte('scheduled_pickup_date', startOfDay)
      .lte('scheduled_pickup_date', endOfDay),
    supabase
      .from('orders')
      .select(selectFields)
      .gte('scheduled_delivery_date', startOfDay)
      .lte('scheduled_delivery_date', endOfDay),
  ]);

  if (pickupRes.error) console.error('Error fetching pickup orders:', pickupRes.error);
  if (deliveryRes.error) console.error('Error fetching delivery orders:', deliveryRes.error);

  // Merge and deduplicate by order ID
  const allOrders = new Map<string, NonNullable<typeof pickupRes.data>[number]>();
  [...(pickupRes.data || []), ...(deliveryRes.data || [])].forEach(o => allOrders.set(o.id, o));
  return Array.from(allOrders.values());
};

// Build a set of trimmed name variants for a driver
const buildDriverNameVariants = (shipdayName?: string | null, fullName?: string | null): Set<string> => {
  const variants = new Set<string>();
  if (shipdayName) variants.add(shipdayName.trim());
  if (fullName) variants.add(fullName.trim());
  return variants;
};

// Match an order against a set of driver name variants
const orderMatchesDriver = (order: { collection_driver_name?: string | null; delivery_driver_name?: string | null }, nameVariants: Set<string>): boolean => {
  const col = order.collection_driver_name?.trim();
  const del = order.delivery_driver_name?.trim();
  return (!!col && nameVariants.has(col)) || (!!del && nameVariants.has(del));
};

// Calculate total jobs by matching driver name + date in orders table (for historic timeslips)
export const calculateTotalJobsFromDriverDate = async (
  shipdayDriverName: string,
  date: string,
  driverFullName?: string | null
): Promise<number> => {
  console.log('🔍 calculateTotalJobsFromDriverDate called:', { shipdayDriverName, driverFullName, date });
  
  const dateFilteredData = await fetchOrdersForDate(date);

  console.log('📅 Orders matching date:', dateFilteredData.length);

  // Filter by driver name variants (shipday name + full name, both trimmed)
  const nameVariants = buildDriverNameVariants(shipdayDriverName, driverFullName);
  const filteredData = dateFilteredData.filter(order => orderMatchesDriver(order, nameVariants));

  console.log('🔎 Filtered orders matching driver:', {
    filtered_count: filteredData.length,
    driver_searched: shipdayDriverName,
  });

  // Get unique order IDs (avoid double-counting if driver does both pickup and delivery)
  const uniqueOrderIds = new Set(filteredData.map((order: any) => order.id));
  
  // Sum bike_quantity for unique orders
  const uniqueOrders = Array.from(uniqueOrderIds).map(id => 
    filteredData.find((order: any) => order.id === id)!
  );
  
  const totalJobs = uniqueOrders.reduce((sum, order) => sum + (order.bike_quantity || 1), 0);
  
  console.log('✅ Total jobs calculated:', {
    unique_orders: uniqueOrders.length,
    total_jobs: totalJobs,
  });
  
  return totalJobs;
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
      timeslip.date,
      timeslip.driver.name
    );
    
    if (jobsFromOrders > 0) {
      return jobsFromOrders;
    }
  } else {
  }

  // Fallback: Calculate from job_locations if order_ids exist
  const orderIds = (timeslip.job_locations || [])
    .map(loc => loc.order_id)
    .filter((id): id is string => !!id);

  if (orderIds.length > 0) {
    const uniqueOrderIds = [...new Set(orderIds)];
    const result = await calculateTotalJobsFromOrders(uniqueOrderIds);
    return result;
  }
  return 0;
};

// Cache for special rate price lookups to avoid repeated queries
interface SpecialRates { special: number | null; large: number | null; largeFrom: string | null; }
const specialRatePriceCache = new Map<string, SpecialRates>();

// Fetch the special_rate_price (and large_bike_rate_price) for a customer, with caching
const getSpecialRates = async (userId: string): Promise<SpecialRates> => {
  if (specialRatePriceCache.has(userId)) {
    return specialRatePriceCache.get(userId)!;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('special_rate_price, large_bike_rate_price, large_bike_rate_from')
    .eq('id', userId)
    .single();

  const rates: SpecialRates = {
    special: (!error && data?.special_rate_price != null) ? Number(data.special_rate_price) : null,
    large: (!error && data?.large_bike_rate_price != null) ? Number(data.large_bike_rate_price) : null,
    largeFrom: (!error && (data as any)?.large_bike_rate_from) ? String((data as any).large_bike_rate_from) : null,
  };
  specialRatePriceCache.set(userId, rates);
  return rates;
};

// Resolve the per-delivery flat price for a special-rate customer.
// Big-bike-flagged jobs use the large bike rate price when one is set and in effect on the job date.
const resolveSpecialRate = (rates: SpecialRates, useLargeBikeRate: boolean, date?: string): number | null => {
  if (rates.special === null) return null;
  const largeActive = rates.large !== null && (!rates.largeFrom || !date || date >= rates.largeFrom);
  if (useLargeBikeRate && largeActive) return rates.large;
  return rates.special;
};

// Before this date the business charged a flat £65 per bike and was not VAT registered.
export const VAT_PRICING_START = '2026-02-02';
const LEGACY_FLAT_RATE = 65;
const VAT_RATE = 1.2;

// Invoiced (net of VAT) transport amount per order, from QuickBooks invoice lines
const invoiceAmountCache = new Map<string, number | null>();
const loadInvoiceAmounts = async (orderIds: string[]) => {
  const missing = orderIds.filter(id => !invoiceAmountCache.has(id));
  for (let i = 0; i < missing.length; i += 200) {
    const chunk = missing.slice(i, i + 200);
    const { data } = await supabase
      .from('order_invoice_links')
      .select('order_id, transport_net_amount')
      .in('order_id', chunk);
    for (const id of chunk) invoiceAmountCache.set(id, null);
    for (const row of (data || []) as Array<{ order_id: string; transport_net_amount: number | null }>) {
      const amt = Number(row.transport_net_amount || 0);
      if (amt > 0) invoiceAmountCache.set(row.order_id, (invoiceAmountCache.get(row.order_id) || 0) + amt);
    }
  }
};

export interface RevenueSourceStats { invoiced: number; estimated: number; estimatedJobs: number; invoicedJobs: number; shopify: number; shopifyJobs: number; }

// Orders booked through the website account are paid at checkout, so they never
// need a QuickBooks invoice. Track their revenue separately from "estimated".
let shopifyUserIdCache: string | null | undefined;
export const getShopifyUserId = async (): Promise<string | null> => {
  if (shopifyUserIdCache !== undefined) return shopifyUserIdCache;
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', 'shopify@cyclecourierco.com')
    .maybeSingle();
  shopifyUserIdCache = data?.id ?? null;
  return shopifyUserIdCache;
};

// Clear the cache (call at start of a new profitability calculation batch)
export const clearSpecialRatePriceCache = () => {
  specialRatePriceCache.clear();
  invoiceAmountCache.clear();
};

// Estimated full (collection + delivery) net price for an order not yet invoiced
export const estimateOrderNet = async (order: any, date: string): Promise<number> => {
  const rates = await getSpecialRates(order.user_id);
  const special = resolveSpecialRate(rates, Boolean(order.use_large_bike_rate), date);
  const qty = order.bike_quantity || 1;
  if (special !== null) return special * qty;
  if (date < VAT_PRICING_START) return LEGACY_FLAT_RATE * qty;
  const bikesArray = order.bikes as Array<{ bike_type?: string; quantity?: number }> | null;
  let gross = 0;
  if (bikesArray && Array.isArray(bikesArray) && bikesArray.length > 0) {
    for (const bike of bikesArray) gross += getRevenuePerStopForBikeType(bike.bike_type || order.bike_type) * 2 * (bike.quantity || 1);
  } else {
    gross = getRevenuePerStopForBikeType(order.bike_type) * 2 * qty;
  }
  return gross / VAT_RATE;
};

// Calculate route revenue from the stops selected in RouteBuilder.
// Each entry is a stop in the route: {orderId, type: 'pickup'|'delivery'}.
// Revenue per stop = (special_rate_price / 2) OR sum of bike-type per-stop prices.
export const getRevenueForRouteStops = async (
  stops: Array<{ orderId: string; type: string }>
): Promise<{ revenue: number; orderCount: number; stopCount: number }> => {
  const relevant = stops.filter(s => s.type === 'pickup' || s.type === 'delivery');
  if (relevant.length === 0) return { revenue: 0, orderCount: 0, stopCount: 0 };

  // Group stops per order to count how many stops of the order are in this route
  const stopsByOrder = new Map<string, number>();
  for (const s of relevant) {
    stopsByOrder.set(s.orderId, (stopsByOrder.get(s.orderId) || 0) + 1);
  }
  const orderIds = Array.from(stopsByOrder.keys());

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, user_id, bikes, bike_type, bike_quantity, use_large_bike_rate')
    .in('id', orderIds);
  if (error || !orders) {
    return { revenue: 0, orderCount: orderIds.length, stopCount: relevant.length };
  }

  let totalRevenue = 0;

  for (const order of orders) {
    const stopsPresent = stopsByOrder.get(order.id) || 0;
    if (stopsPresent === 0) continue;

    const specialRate = resolveSpecialRate(await getSpecialRates(order.user_id), Boolean(order.use_large_bike_rate), new Date().toISOString().slice(0, 10));

    let perStopValue = 0;
    if (specialRate !== null) {
      const qty = order.bike_quantity || 1;
      perStopValue = (specialRate / 2) * qty;
    } else {
      const bikesArray = order.bikes as Array<{ bike_type?: string; quantity?: number }> | null;
      if (bikesArray && Array.isArray(bikesArray) && bikesArray.length > 0) {
        for (const bike of bikesArray) {
          const qty = bike.quantity || 1;
          perStopValue += getRevenuePerStopForBikeType(bike.bike_type || order.bike_type) * qty;
        }
      } else {
        const qty = order.bike_quantity || 1;
        perStopValue = getRevenuePerStopForBikeType(order.bike_type) * qty;
      }
    }

    totalRevenue += perStopValue * stopsPresent;
  }

  return { revenue: totalRevenue, orderCount: orderIds.length, stopCount: relevant.length };
};

// Fetch orders for a timeslip and calculate revenue based on bike types (halved per stop)
// If a customer has a special_rate_price, use that instead of standard bike-type pricing
export const getRevenueForTimeslip = async (timeslip: Timeslip, stats?: RevenueSourceStats): Promise<number> => {
  const driverName = timeslip.driver?.shipday_driver_name;
  const driverFullName = timeslip.driver?.name;
  const date = timeslip.date;

  if ((!driverName && !driverFullName) || !date) return 0;

  const nameVariants = buildDriverNameVariants(driverName, driverFullName);
  const dateFilteredOrders = await fetchOrdersForDate(date);

  const driverOrders = dateFilteredOrders.filter(order => orderMatchesDriver(order, nameVariants));

  // Deduplicate by order ID
  const uniqueOrders = Array.from(
    new Map(driverOrders.map(o => [o.id, o])).values()
  );

  let totalRevenue = 0;
  await loadInvoiceAmounts(uniqueOrders.map(o => o.id));
  const shopifyId = stats ? await getShopifyUserId() : null;

  for (const order of uniqueOrders) {
    // Count each leg this driver did on this date (collection and delivery both count)
    const col = order.collection_driver_name?.trim();
    const del = order.delivery_driver_name?.trim();
    const pDate = String(order.scheduled_pickup_date || '').slice(0, 10);
    const dDate = String(order.scheduled_delivery_date || '').slice(0, 10);
    const legs = Math.max(1,
      (col && nameVariants.has(col) && pDate === date ? 1 : 0) +
      (del && nameVariants.has(del) && dDate === date ? 1 : 0));

    const invoiced = invoiceAmountCache.get(order.id);
    if (invoiced != null && invoiced > 0) {
      const value = (invoiced / 2) * legs;
      totalRevenue += value;
      if (stats) { stats.invoiced += value; stats.invoicedJobs += 1; }
      continue;
    }
    const value = ((await estimateOrderNet(order, date)) / 2) * legs;
    totalRevenue += value;
    if (stats) {
      if (shopifyId && order.user_id === shopifyId) {
        stats.shopify += value; stats.shopifyJobs += 1;
      } else {
        stats.estimated += value; stats.estimatedJobs += 1;
      }
    }
  }

  return totalRevenue;
};

// ============ Cost basis: real fuel + maintenance vs flat-rate estimate ============
export type CostMode = 'actual' | 'flat';

// Net fuel (from uploaded fuel invoices) + maintenance cost per van per month.
// Key: `${vehicle_id}|${yyyy-MM}` -> net £
let vehicleCostCache: { at: number; data: Map<string, number> } | null = null;
const VEHICLE_COST_TTL = 10 * 60 * 1000;

export const getVehicleMonthlyCosts = async (): Promise<Map<string, number>> => {
  if (vehicleCostCache && Date.now() - vehicleCostCache.at < VEHICLE_COST_TTL) return vehicleCostCache.data;
  const data = new Map<string, number>();
  const add = (vehicleId: unknown, date: unknown, amount: unknown) => {
    if (!vehicleId || !date || !amount) return;
    const key = `${vehicleId}|${String(date).slice(0, 7)}`;
    data.set(key, (data.get(key) || 0) + Number(amount));
  };
  const loadTable = async (table: string, dateCol: string, amountCol: string) => {
    for (let from = 0; ; from += 1000) {
      const { error, data: rows } = await supabase
        .from(table)
        .select(`${dateCol}, vehicle_id, ${amountCol}`)
        .range(from, from + 999);
      if (error) { console.error(`Error loading ${table} for cost basis:`, error); break; }
      for (const r of (rows || []) as Array<Record<string, unknown>>) {
        add(r.vehicle_id, r[dateCol], Number(r[amountCol] || 0));
      }
      if (!rows || rows.length < 1000) break;
    }
  };
  await Promise.all([
    loadTable('fuel_transactions', 'trx_date', 'net_amount'),
    loadTable('vehicle_maintenance_logs', 'service_date', 'cost'),
  ]);
  vehicleCostCache = { at: Date.now(), data };
  return data;
};

// Per van, per month real cost per mile: (fuel net + maintenance) / miles driven that month
export const buildVehicleCostPerMile = (timeslips: Timeslip[], costs: Map<string, number>): Map<string, number> => {
  const miles = new Map<string, number>();
  for (const ts of timeslips) {
    if (!ts.vehicle_id || !ts.date) continue;
    const key = `${ts.vehicle_id}|${ts.date.slice(0, 7)}`;
    miles.set(key, (miles.get(key) || 0) + (ts.mileage || 0));
  }
  const rates = new Map<string, number>();
  for (const [key, m] of miles) {
    if (m <= 0) continue;
    rates.set(key, (costs.get(key) || 0) / m);
  }
  return rates;
};

let costContext: { mode: CostMode; rateMap: Map<string, number> | null } = { mode: 'flat', rateMap: null };
export const setCostContext = (mode: CostMode, rateMap: Map<string, number> | null) => {
  costContext = { mode, rateMap };
};

export const prepareCostContext = async (mode: CostMode, timeslips: Timeslip[]) => {
  if (mode === 'actual') {
    const costs = await getVehicleMonthlyCosts();
    setCostContext('actual', buildVehicleCostPerMile(timeslips, costs));
  } else {
    setCostContext('flat', null);
  }
};

export const calculateProfitability = (
  totalJobs: number,
  timeslip: Timeslip,
  revenuePerStop: number,
  costPerMile: number,
  preCalculatedRevenue?: number
): ProfitabilityMetrics => {
  // Use pre-calculated revenue (bike-type mode) or flat rate
  const revenue = preCalculatedRevenue !== undefined ? preCalculatedRevenue : totalJobs * revenuePerStop;

  // Calculate custom addon costs
  const customAddonCosts = (timeslip.custom_addons || []).reduce((sum, addon) => {
    return sum + (addon.hours * timeslip.hourly_rate);
  }, 0);

  // Mileage costs: in 'actual' mode use the van's real fuel + maintenance cost per mile
  // for the van and month of the timeslip; otherwise the flat estimate rate.
  let mileageCosts: number;
  if (costContext.mode === 'actual' && costContext.rateMap && timeslip.vehicle_id && timeslip.date) {
    const rate = costContext.rateMap.get(`${timeslip.vehicle_id}|${timeslip.date.slice(0, 7)}`) ?? 0;
    mileageCosts = (timeslip.mileage || 0) * rate;
  } else {
    mileageCosts = (timeslip.mileage || 0) * costPerMile;
  }

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
  costPerMile: number,
  useBikeTypePricing: boolean = false,
  costMode: CostMode = 'flat'
) => {
  clearSpecialRatePriceCache();
  await prepareCostContext(costMode, timeslips);
  let totalRevenue = 0;
  let totalCosts = 0;
  let totalProfit = 0;

  for (const timeslip of timeslips) {
    const totalJobs = await getTotalJobs(timeslip);
    const bikeRevenue = useBikeTypePricing ? await getRevenueForTimeslip(timeslip) : undefined;
    const metrics = calculateProfitability(totalJobs, timeslip, revenuePerStop, costPerMile, bikeRevenue);
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
  costPerMile: number,
  useBikeTypePricing: boolean = false,
  costMode: CostMode = 'flat'
): Promise<DailyProfitability[]> => {
  await prepareCostContext(costMode, timeslips);
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
      const bikeRevenue = useBikeTypePricing ? await getRevenueForTimeslip(timeslip) : undefined;
      const metrics = calculateProfitability(totalJobs, timeslip, revenuePerStop, costPerMile, bikeRevenue);
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
  return fetchApprovedTimeslips(format(monthStart, 'yyyy-MM-dd'), format(endOfMonth(monthStart), 'yyyy-MM-dd'));
};

// Get timeslips for an entire year
export const getTimeslipsForYear = async (year: number): Promise<Timeslip[]> => {
  const yearStart = startOfYear(new Date(year, 0));
  return fetchApprovedTimeslips(format(yearStart, 'yyyy-MM-dd'), format(endOfYear(yearStart), 'yyyy-MM-dd'));
};

// Calculate weekly profitability for a month (returns 4-5 weeks)
export const calculateWeeklyProfitabilityForMonth = async (
  timeslips: Timeslip[],
  year: number,
  month: number,
  revenuePerStop: number,
  costPerMile: number,
  useBikeTypePricing: boolean = false,
  costMode: CostMode = 'flat'
): Promise<WeeklyProfitabilityData[]> => {
  await prepareCostContext(costMode, timeslips);
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
      
      const dayMetrics = await mapLimit(dayTimeslips, 8, async (timeslip) => {
        const totalJobs = await getTotalJobs(timeslip);
        const bikeRevenue = useBikeTypePricing ? await getRevenueForTimeslip(timeslip) : undefined;
        return calculateProfitability(totalJobs, timeslip, revenuePerStop, costPerMile, bikeRevenue);
      });
      for (const metrics of dayMetrics) {
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
  costPerMile: number,
  useBikeTypePricing: boolean = false,
  costMode: CostMode = 'flat'
): Promise<MonthlyProfitabilityData[]> => {
  await prepareCostContext(costMode, timeslips);
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

    const monthMetrics = await mapLimit(monthTimeslips, 8, async (timeslip) => {
      const totalJobs = await getTotalJobs(timeslip);
      const bikeRevenue = useBikeTypePricing ? await getRevenueForTimeslip(timeslip) : undefined;
      return calculateProfitability(totalJobs, timeslip, revenuePerStop, costPerMile, bikeRevenue);
    });
    for (const metrics of monthMetrics) {
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

// Unit Economics
export interface UnitEconomicsMetrics {
  revenuePerStop: number;
  costPerStop: number;
  profitPerStop: number;
  revenuePerMile: number;
  costPerMile: number;
  profitPerMile: number;
  revenuePerDriverDay: number;
  costPerDriverDay: number;
  profitPerDriverDay: number;
  revenuePerHour: number;
  revenuePerJob: number;
  costPerJob: number;
  profitPerJob: number;
  totalJobs: number;
  totalStops: number;
  totalMiles: number;
  totalHours: number;
  driverDays: number;
}

export const calculateUnitEconomics = (
  timeslips: Timeslip[],
  totalRevenue: number,
  totalCosts: number,
  totalProfit: number
): UnitEconomicsMetrics => {
  const totalStops = timeslips.reduce((sum, ts) => sum + (ts.total_stops || 0), 0);
  const totalJobs = timeslips.reduce((sum, ts) => sum + (ts.total_jobs ?? ts.total_stops ?? 0), 0);
  const totalMiles = timeslips.reduce((sum, ts) => sum + (ts.mileage || 0), 0);
  const totalHours = timeslips.reduce((sum, ts) => sum + (ts.total_hours || 0), 0);
  const driverDays = timeslips.length;

  const safe = (num: number, den: number) => den > 0 ? num / den : 0;

  return {
    revenuePerStop: safe(totalRevenue, totalStops),
    costPerStop: safe(totalCosts, totalStops),
    profitPerStop: safe(totalProfit, totalStops),
    revenuePerMile: safe(totalRevenue, totalMiles),
    costPerMile: safe(totalCosts, totalMiles),
    profitPerMile: safe(totalProfit, totalMiles),
    revenuePerDriverDay: safe(totalRevenue, driverDays),
    costPerDriverDay: safe(totalCosts, driverDays),
    profitPerDriverDay: safe(totalProfit, driverDays),
    revenuePerHour: safe(totalRevenue, totalHours),
    revenuePerJob: safe(totalRevenue, totalJobs),
    costPerJob: safe(totalCosts, totalJobs),
    profitPerJob: safe(totalProfit, totalJobs),
    totalJobs,
    totalStops,
    totalMiles,
    totalHours,
    driverDays,
  };
};

export interface MonthlyReconciliationRow {
  month: string; // YYYY-MM
  pageRevenue: number;
  invoicedOnPage: number;
  estimatedOnPage: number;
  estimatedJobs: number;
  shopifyOnPage: number;
  shopifyJobs: number;
  invoicedTransport: number;
}

// Compare page revenue (approved timeslips) against all transport invoiced in QuickBooks per month
export const getMonthlyReconciliation = async (year: number): Promise<MonthlyReconciliationRow[]> => {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const timeslips = await fetchApprovedTimeslips(start, end);
  const rows = new Map<string, MonthlyReconciliationRow>();
  const row = (m: string) => {
    if (!rows.has(m)) rows.set(m, { month: m, pageRevenue: 0, invoicedOnPage: 0, estimatedOnPage: 0, estimatedJobs: 0, shopifyOnPage: 0, shopifyJobs: 0, invoicedTransport: 0 });
    return rows.get(m)!;
  };
  const results = await mapLimit(timeslips, 8, async (ts) => {
    const stats: RevenueSourceStats = { invoiced: 0, estimated: 0, estimatedJobs: 0, invoicedJobs: 0, shopify: 0, shopifyJobs: 0 };
    const rev = await getRevenueForTimeslip(ts, stats);
    return { ts, stats, rev };
  });
  for (const { ts, stats, rev } of results) {
    const r = row(ts.date.slice(0, 7));
    r.pageRevenue += rev;
    r.invoicedOnPage += stats.invoiced;
    r.estimatedOnPage += stats.estimated;
    r.estimatedJobs += stats.estimatedJobs;
    r.shopifyOnPage += stats.shopify;
    r.shopifyJobs += stats.shopifyJobs;
  }
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('order_invoice_links')
      .select('id, invoice_date, transport_net_amount')
      .gte('invoice_date', start)
      .lte('invoice_date', end)
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    for (const l of (data || []) as Array<{ invoice_date: string | null; transport_net_amount: number | null }>) {
      if (!l.invoice_date) continue;
      row(String(l.invoice_date).slice(0, 7)).invoicedTransport += Number(l.transport_net_amount || 0);
    }
    if (!data || data.length < 1000) break;
  }
  return Array.from(rows.values()).sort((a, b) => a.month.localeCompare(b.month));
};
