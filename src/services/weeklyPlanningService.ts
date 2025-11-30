import { OrderData } from "@/pages/JobScheduling";
import { format, addDays, isWithinInterval, startOfWeek, endOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { DEPOT_LOCATION } from "@/constants/depot";

const MAX_ROUTE_DISTANCE_MILES = 600;
const DEPOT = DEPOT_LOCATION;

export type Region = 'midlands' | 'north' | 'wales' | 'south' | 'scotland';

export interface Job {
  orderId: string;
  type: 'collection' | 'delivery';
  contactName: string;
  address: string;
  phoneNumber: string;
  order: OrderData;
  lat: number;
  lon: number;
  region: Region;
}

export interface DriverAssignment {
  driverIndex: number;
  jobs: Job[];
  estimatedDistance: number;
  region?: Region;
}

export interface DayPlan {
  day: string;
  date: Date;
  drivers: DriverAssignment[];
  totalJobs: number;
  totalDistance: number;
}

export interface WeeklyPlan {
  weekStart: Date;
  weekEnd: Date;
  days: DayPlan[];
  driversPerDay: Record<string, number>;
  isSaved?: boolean;
}

// Calculate distance between two coordinates using Haversine formula
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Determine which jobs are needed based on order status
const getJobsForOrder = (order: OrderData): ('collection' | 'delivery')[] => {
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

// Get region based on location
export const getRegion = (lat: number, lon: number): Region => {
  const distanceFromDepot = calculateDistance(DEPOT.lat, DEPOT.lon, lat, lon);
  
  // Within 80km of depot = Midlands
  if (distanceFromDepot < 80) return 'midlands';
  
  // Use latitude/longitude to determine region
  if (lat > 54.5) return 'scotland';
  if (lat > 53.0 && lon > -2.5) return 'north'; // Yorkshire, North East
  if (lon < -2.5 && lat > 51.5) return 'wales'; // Wales & West
  return 'south'; // South, South East, South West
};

// Get available days for an order based on customer preferences
export const getAvailableDaysForOrder = (order: OrderData, weekStart: Date, isCollection: boolean): Date[] => {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const dates: Date[] = [];
  
  const dateArray = isCollection ? order.pickup_date : order.delivery_date;
  
  if (!dateArray || dateArray.length === 0) {
    // No specific dates - all weekdays are available
    for (let i = 0; i < 5; i++) {
      const day = addDays(weekStart, i);
      dates.push(day);
    }
    return dates;
  }
  
  // Parse date array and filter for this week
  dateArray.forEach(dateStr => {
    try {
      const date = new Date(dateStr);
      if (isWithinInterval(date, { start: weekStart, end: weekEnd })) {
        // Exclude weekends
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          dates.push(date);
        }
      }
    } catch (e) {
      console.warn('Invalid date in order:', dateStr);
    }
  });
  
  // If no dates fall in this week, allow all weekdays
  if (dates.length === 0) {
    for (let i = 0; i < 5; i++) {
      const day = addDays(weekStart, i);
      dates.push(day);
    }
  }
  
  return dates;
};

// Calculate route distance starting from depot
const calculateRouteDistance = (jobs: Job[]): number => {
  if (jobs.length === 0) return 0;
  
  let totalDistance = 0;
  let prevLoc = { lat: DEPOT.lat, lon: DEPOT.lon };
  
  jobs.forEach(job => {
    totalDistance += calculateDistance(prevLoc.lat, prevLoc.lon, job.lat, job.lon);
    prevLoc = { lat: job.lat, lon: job.lon };
  });
  
  // Return to depot
  totalDistance += calculateDistance(prevLoc.lat, prevLoc.lon, DEPOT.lat, DEPOT.lon);
  
  return totalDistance * 0.621371; // km to miles
};

// Validate route doesn't exceed max distance
const validateRouteDistance = (jobs: Job[]): boolean => {
  return calculateRouteDistance(jobs) <= MAX_ROUTE_DISTANCE_MILES;
};

// Group jobs by region
const groupJobsByRegion = (jobs: Job[]): Map<Region, Job[]> => {
  const regionMap = new Map<Region, Job[]>();
  
  jobs.forEach(job => {
    const existing = regionMap.get(job.region) || [];
    existing.push(job);
    regionMap.set(job.region, existing);
  });
  
  return regionMap;
};

// Balance workload across drivers for a single day with regional clustering
export const balanceDriverWorkload = (
  dayJobs: Job[],
  numberOfDrivers: number,
  maxJobsPerDriver: number = 25
): DriverAssignment[] => {
  if (numberOfDrivers === 1) {
    return [{
      driverIndex: 0,
      jobs: dayJobs,
      estimatedDistance: calculateRouteDistance(dayJobs),
      region: dayJobs[0]?.region
    }];
  }
  
  // Group jobs by region first
  const regionGroups = groupJobsByRegion(dayJobs);
  
  // Initialize driver assignments
  const drivers: DriverAssignment[] = Array.from({ length: numberOfDrivers }, (_, i) => ({
    driverIndex: i,
    jobs: [],
    estimatedDistance: 0,
    region: undefined
  }));
  
  // Assign regional groups to drivers
  let driverIdx = 0;
  regionGroups.forEach((jobs, region) => {
    // Try to keep regional groups together
    const driver = drivers[driverIdx % numberOfDrivers];
    
    // Check if adding these jobs exceeds limits
    if (driver.jobs.length + jobs.length <= maxJobsPerDriver) {
      driver.jobs.push(...jobs);
      driver.region = driver.region || region;
      driver.estimatedDistance = calculateRouteDistance(driver.jobs);
    } else {
      // Split across multiple drivers if needed
      let remainingJobs = [...jobs];
      while (remainingJobs.length > 0) {
        const currentDriver = drivers.find(d => d.jobs.length < maxJobsPerDriver) || drivers[0];
        const available = maxJobsPerDriver - currentDriver.jobs.length;
        const toAdd = remainingJobs.splice(0, available);
        currentDriver.jobs.push(...toAdd);
        currentDriver.region = currentDriver.region || region;
        currentDriver.estimatedDistance = calculateRouteDistance(currentDriver.jobs);
      }
    }
    
    driverIdx++;
  });
  
  return drivers.filter(d => d.jobs.length > 0);
};

// Enforce collection before delivery for same order
const enforceCollectionBeforeDelivery = (dayPlans: DayPlan[], orders: OrderData[]): DayPlan[] => {
  const ordersMap = new Map(orders.map(o => [o.id, o]));
  
  // Build map of order -> day index for collections and deliveries
  const collectionDays = new Map<string, number>();
  const deliveryDays = new Map<string, number>();
  
  dayPlans.forEach((dayPlan, dayIdx) => {
    dayPlan.drivers.forEach(driver => {
      driver.jobs.forEach(job => {
        if (job.type === 'collection') {
          collectionDays.set(job.orderId, dayIdx);
        } else {
          deliveryDays.set(job.orderId, dayIdx);
        }
      });
    });
  });
  
  // Check for violations and move deliveries to later days
  const violations: { orderId: string; collectionDay: number; deliveryDay: number }[] = [];
  
  deliveryDays.forEach((deliveryDay, orderId) => {
    const collectionDay = collectionDays.get(orderId);
    if (collectionDay !== undefined && deliveryDay <= collectionDay) {
      violations.push({ orderId, collectionDay, deliveryDay });
    }
  });
  
  // Move delivery jobs to day after collection
  violations.forEach(({ orderId, collectionDay }) => {
    const targetDay = Math.min(collectionDay + 1, dayPlans.length - 1);
    
    // Find and remove delivery job from current location
    for (const dayPlan of dayPlans) {
      for (const driver of dayPlan.drivers) {
        const jobIdx = driver.jobs.findIndex(j => j.orderId === orderId && j.type === 'delivery');
        if (jobIdx !== -1) {
          const [job] = driver.jobs.splice(jobIdx, 1);
          
          // Add to target day (first driver with space)
          const targetDriver = dayPlans[targetDay].drivers[0];
          if (targetDriver) {
            targetDriver.jobs.push(job);
            targetDriver.estimatedDistance = calculateRouteDistance(targetDriver.jobs);
          }
          return;
        }
      }
    }
  });
  
  return dayPlans;
};

// Assign orders to week with improved logic
export const assignOrdersToWeek = (
  orders: OrderData[],
  weekStart: Date,
  driversPerDay: Record<string, number>
): WeeklyPlan => {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  
  // Step 1: Create all pending jobs (one per order per type)
  const pendingJobs: (Job & { availableDays: number[] })[] = [];
  
  orders.forEach(order => {
    const jobTypes = getJobsForOrder(order);
    
    jobTypes.forEach(type => {
      const isCollection = type === 'collection';
      const contact = isCollection ? order.sender : order.receiver;
      
      if (contact.address.lat && contact.address.lon) {
        const availableDays = getAvailableDaysForOrder(order, weekStart, isCollection);
        const availableDayIndices = availableDays.map(date => 
          Math.floor((date.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
        ).filter(idx => idx >= 0 && idx < 5);
        
        if (availableDayIndices.length > 0) {
          pendingJobs.push({
            orderId: order.id,
            type,
            contactName: contact.name,
            address: `${contact.address.street}, ${contact.address.city}`,
            phoneNumber: contact.phone,
            order,
            lat: contact.address.lat,
            lon: contact.address.lon,
            region: getRegion(contact.address.lat, contact.address.lon),
            availableDays: availableDayIndices
          });
        }
      }
    });
  });
  
  // Step 2: Group jobs by region
  const jobsByRegion = groupJobsByRegion(pendingJobs.map(({ availableDays, ...job }) => job));
  
  // Step 3: Assign regional groups to specific days
  const dayPlans: DayPlan[] = days.map((dayName, dayIdx) => ({
    day: dayName,
    date: addDays(weekStart, dayIdx),
    drivers: [],
    totalJobs: 0,
    totalDistance: 0
  }));
  
  // Distribute regions across days
  let dayIdx = 0;
  jobsByRegion.forEach((jobs, region) => {
    // Filter jobs available for this day
    const availableJobs = jobs.filter(job => {
      const pendingJob = pendingJobs.find(pj => pj.orderId === job.orderId && pj.type === job.type);
      return pendingJob?.availableDays.includes(dayIdx);
    });
    
    if (availableJobs.length > 0) {
      const dayName = days[dayIdx];
      const numDrivers = driversPerDay[dayName] || 1;
      const driverAssignments = balanceDriverWorkload(availableJobs, numDrivers);
      
      dayPlans[dayIdx].drivers = driverAssignments;
      dayPlans[dayIdx].totalJobs = availableJobs.length;
      dayPlans[dayIdx].totalDistance = driverAssignments.reduce((sum, d) => sum + d.estimatedDistance, 0);
    }
    
    dayIdx = (dayIdx + 1) % 5;
  });
  
  // Step 4: Enforce collection before delivery
  const finalDayPlans = enforceCollectionBeforeDelivery(dayPlans, orders);
  
  return {
    weekStart,
    weekEnd: endOfWeek(weekStart, { weekStartsOn: 1 }),
    days: finalDayPlans,
    driversPerDay,
    isSaved: false
  };
};

// Save plan to database
export const savePlanToDatabase = async (plan: WeeklyPlan): Promise<boolean> => {
  try {
    const weekStartStr = format(plan.weekStart, 'yyyy-MM-dd');
    
    // Delete existing plans for this week
    await supabase
      .from('weekly_plans')
      .delete()
      .eq('week_start', weekStartStr);
    
    // Insert new plans
    const inserts = plan.days.flatMap((dayPlan, dayIdx) =>
      dayPlan.drivers.map(driver => ({
        week_start: weekStartStr,
        day_of_week: dayIdx,
        driver_index: driver.driverIndex,
        region: driver.region || null,
        job_data: driver.jobs as any,
        total_distance_miles: driver.estimatedDistance,
        is_optimized: false
      }))
    );
    
    const { error } = await supabase
      .from('weekly_plans')
      .insert(inserts);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error saving plan:', error);
    return false;
  }
};

// Load plan from database
export const loadPlanFromDatabase = async (weekStart: Date): Promise<WeeklyPlan | null> => {
  try {
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('week_start', weekStartStr)
      .order('day_of_week')
      .order('driver_index');
    
    if (error) throw error;
    if (!data || data.length === 0) return null;
    
    // Reconstruct the plan
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const dayPlans: DayPlan[] = days.map((dayName, dayIdx) => ({
      day: dayName,
      date: addDays(weekStart, dayIdx),
      drivers: [],
      totalJobs: 0,
      totalDistance: 0
    }));
    
    const driversPerDay: Record<string, number> = {};
    
    data.forEach(record => {
      const dayPlan = dayPlans[record.day_of_week];
      const jobs = record.job_data as unknown as Job[];
      
      dayPlan.drivers.push({
        driverIndex: record.driver_index,
        jobs,
        estimatedDistance: record.total_distance_miles || 0,
        region: record.region as Region | undefined
      });
      
      dayPlan.totalJobs += jobs.length;
      dayPlan.totalDistance += record.total_distance_miles || 0;
      
      const dayName = days[record.day_of_week];
      driversPerDay[dayName] = Math.max(driversPerDay[dayName] || 0, record.driver_index + 1);
    });
    
    return {
      weekStart,
      weekEnd: endOfWeek(weekStart, { weekStartsOn: 1 }),
      days: dayPlans,
      driversPerDay,
      isSaved: true
    };
  } catch (error) {
    console.error('Error loading plan:', error);
    return null;
  }
};

// Prioritize days by job count
export const prioritizeDays = (plan: WeeklyPlan): string[] => {
  return [...plan.days]
    .sort((a, b) => b.totalJobs - a.totalJobs)
    .map(day => day.day);
};
