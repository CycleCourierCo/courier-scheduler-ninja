import { OrderData } from "@/pages/JobScheduling";
import { format, addDays, isWithinInterval, startOfWeek, endOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { DEPOT_LOCATION } from "@/constants/depot";

const MAX_BIKES_ON_VAN = 10;
const MAX_ROUTE_DISTANCE_MILES = 600;
const DEPOT = DEPOT_LOCATION;

// Working days: Mon-Thu + Sat-Sun (Friday removed)
const WORKING_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'saturday', 'sunday'] as const;
const DAY_INDICES = [0, 1, 2, 3, 5, 6]; // addDays indices from Monday

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
  bikeQuantity: number;
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
    // No specific dates - all working days are available
    DAY_INDICES.forEach(idx => {
      dates.push(addDays(weekStart, idx));
    });
    return dates;
  }
  
  // Parse date array and filter for this week
  dateArray.forEach(dateStr => {
    try {
      const date = new Date(dateStr);
      if (isWithinInterval(date, { start: weekStart, end: weekEnd })) {
        const dayOfWeek = date.getDay();
        // Include Mon-Thu (1-4) and Sat-Sun (6,0)
        if ((dayOfWeek >= 1 && dayOfWeek <= 4) || dayOfWeek === 6 || dayOfWeek === 0) {
          dates.push(date);
        }
      }
    } catch (e) {
      console.warn('Invalid date in order:', dateStr);
    }
  });
  
  // If no dates fall in this week, allow all working days
  if (dates.length === 0) {
    DAY_INDICES.forEach(idx => {
      dates.push(addDays(weekStart, idx));
    });
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

/**
 * Calculate the maximum number of bikes on the van at any point in the route.
 * Collections add bikes, deliveries remove bikes.
 * Worst case: all collections happen before deliveries.
 */
const calculatePeakBikeCount = (jobs: Job[]): number => {
  const collections = jobs.filter(j => j.type === 'collection');
  const totalCollected = collections.reduce((sum, j) => sum + j.bikeQuantity, 0);
  return totalCollected;
};

// Calculate required drivers for a set of jobs
export const calculateRequiredDrivers = (jobs: Job[]): number => {
  if (jobs.length === 0) return 0;
  
  const regionGroups = groupJobsByRegion(jobs);
  let totalDriversNeeded = 0;
  
  regionGroups.forEach((regionJobs) => {
    // Calculate drivers needed based on:
    // 1. Bike capacity (max 10 bikes on van at peak)
    const totalBikesToCollect = regionJobs
      .filter(j => j.type === 'collection')
      .reduce((sum, j) => sum + j.bikeQuantity, 0);
    const driversByBikeCapacity = Math.ceil(totalBikesToCollect / MAX_BIKES_ON_VAN);
    
    // 2. Route distance (max 600 miles)
    const estimatedRegionDistance = calculateRouteDistance(regionJobs);
    const driversByDistance = Math.ceil(estimatedRegionDistance / MAX_ROUTE_DISTANCE_MILES);
    
    // Take the higher of the two constraints
    totalDriversNeeded += Math.max(driversByBikeCapacity, driversByDistance);
  });
  
  return Math.max(1, totalDriversNeeded);
};

// Balance workload across drivers for a single day with regional clustering
export const balanceDriverWorkload = (
  dayJobs: Job[],
  numberOfDrivers: number
): DriverAssignment[] => {
  if (dayJobs.length === 0) return [];
  
  const regionGroups = groupJobsByRegion(dayJobs);
  const drivers: DriverAssignment[] = [];
  let driverIdx = 0;
  
  const createDriver = (): DriverAssignment => ({
    driverIndex: driverIdx++,
    jobs: [],
    estimatedDistance: 0,
    region: undefined
  });
  
  // Check if adding a job is valid (bike capacity + distance)
  const canAddJob = (driver: DriverAssignment, job: Job): boolean => {
    const testJobs = [...driver.jobs, job];
    
    // Check bike capacity
    const peakBikes = calculatePeakBikeCount(testJobs);
    if (peakBikes > MAX_BIKES_ON_VAN) return false;
    
    // Check distance
    const testDistance = calculateRouteDistance(testJobs);
    if (testDistance > MAX_ROUTE_DISTANCE_MILES) return false;
    
    return true;
  };
  
  // Process each region's jobs
  regionGroups.forEach((regionJobs, region) => {
    regionJobs.forEach(job => {
      // Find an existing driver that can take this job (same region preferred)
      let assignedDriver = drivers.find(d => 
        d.region === region && canAddJob(d, job)
      );
      
      // If no same-region driver, find any driver with capacity
      if (!assignedDriver) {
        assignedDriver = drivers.find(d => canAddJob(d, job));
      }
      
      // If no existing driver can take it, create a new one
      if (!assignedDriver) {
        assignedDriver = createDriver();
        assignedDriver.region = region;
        drivers.push(assignedDriver);
      }
      
      // Add job and recalculate distance
      assignedDriver.jobs.push(job);
      assignedDriver.estimatedDistance = calculateRouteDistance(assignedDriver.jobs);
    });
  });
  
  return drivers;
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
          driver.estimatedDistance = calculateRouteDistance(driver.jobs);
          
          // Find a driver with capacity on target day, or create new one
          const targetDrivers = dayPlans[targetDay].drivers;
          let targetDriver = targetDrivers.find(d => {
            const testJobs = [...d.jobs, job];
            const peakBikes = calculatePeakBikeCount(testJobs);
            const testDistance = calculateRouteDistance(testJobs);
            return peakBikes <= MAX_BIKES_ON_VAN && testDistance <= MAX_ROUTE_DISTANCE_MILES;
          });
          
          if (!targetDriver) {
            // Create new driver for target day
            targetDriver = {
              driverIndex: targetDrivers.length,
              jobs: [],
              estimatedDistance: 0,
              region: job.region
            };
            targetDrivers.push(targetDriver);
          }
          
          targetDriver.jobs.push(job);
          targetDriver.estimatedDistance = calculateRouteDistance(targetDriver.jobs);
          return;
        }
      }
    }
  });
  
  return dayPlans;
};

// Assign orders to week with auto-calculated drivers
export const assignOrdersToWeek = (
  orders: OrderData[],
  weekStart: Date
): WeeklyPlan => {
  // Step 1: Create all pending jobs (one per order per type)
  const pendingJobs: (Job & { availableDays: number[] })[] = [];
  
  orders.forEach(order => {
    const jobTypes = getJobsForOrder(order);
    
    jobTypes.forEach(type => {
      const isCollection = type === 'collection';
      const contact = isCollection ? order.sender : order.receiver;
      
      if (contact.address.lat && contact.address.lon) {
        const availableDays = getAvailableDaysForOrder(order, weekStart, isCollection);
        const availableDayIndices = availableDays.map(date => {
          const dayOfWeek = date.getDay();
          // Map to our working days array indices
          if (dayOfWeek === 1) return 0; // Monday
          if (dayOfWeek === 2) return 1; // Tuesday
          if (dayOfWeek === 3) return 2; // Wednesday
          if (dayOfWeek === 4) return 3; // Thursday
          if (dayOfWeek === 6) return 4; // Saturday
          if (dayOfWeek === 0) return 5; // Sunday
          return -1;
        }).filter(idx => idx >= 0);
        
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
            bikeQuantity: order.bike_quantity || 1,
            availableDays: availableDayIndices
          });
        }
      }
    });
  });
  
  // Step 2: Initialize day plans
  const dayPlans: DayPlan[] = WORKING_DAYS.map((dayName, idx) => ({
    day: dayName,
    date: addDays(weekStart, DAY_INDICES[idx]),
    drivers: [],
    totalJobs: 0,
    totalDistance: 0
  }));
  
  // Step 3: Assign jobs to days based on availability
  const dayJobs: Job[][] = WORKING_DAYS.map(() => []);
  
  pendingJobs.forEach(({ availableDays, ...job }) => {
    // Find the available day with the least jobs assigned (balance workload)
    let bestDayIdx = availableDays[0];
    let minJobs = dayJobs[bestDayIdx]?.length || 0;
    
    availableDays.forEach(dayIdx => {
      const currentJobCount = dayJobs[dayIdx]?.length || 0;
      if (currentJobCount < minJobs) {
        minJobs = currentJobCount;
        bestDayIdx = dayIdx;
      }
    });
    
    if (bestDayIdx >= 0 && bestDayIdx < WORKING_DAYS.length) {
      dayJobs[bestDayIdx].push(job);
    }
  });
  
  // Step 4: Calculate required drivers per day and assign jobs
  const driversPerDay: Record<string, number> = {};
  
  WORKING_DAYS.forEach((dayName, dayIdx) => {
    const jobs = dayJobs[dayIdx];
    const numDrivers = calculateRequiredDrivers(jobs);
    driversPerDay[dayName] = numDrivers;
    
    if (jobs.length > 0) {
      const driverAssignments = balanceDriverWorkload(jobs, numDrivers);
      dayPlans[dayIdx].drivers = driverAssignments;
      dayPlans[dayIdx].totalJobs = jobs.length;
      dayPlans[dayIdx].totalDistance = driverAssignments.reduce((sum, d) => sum + d.estimatedDistance, 0);
    }
  });
  
  // Step 5: Enforce collection before delivery
  const finalDayPlans = enforceCollectionBeforeDelivery(dayPlans, orders);
  
  // Step 6: Recalculate driversPerDay based on actual assignments after enforcement
  WORKING_DAYS.forEach((dayName, dayIdx) => {
    driversPerDay[dayName] = finalDayPlans[dayIdx].drivers.length;
  });
  
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
        day_of_week: dayIdx, // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Sat, 5=Sun
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
    const dayPlans: DayPlan[] = WORKING_DAYS.map((dayName, idx) => ({
      day: dayName,
      date: addDays(weekStart, DAY_INDICES[idx]),
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
      
      const dayName = WORKING_DAYS[record.day_of_week];
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
