import { OrderData } from "@/pages/JobScheduling";
import { format, addDays, isWithinInterval, startOfWeek, endOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { DEPOT_LOCATION } from "@/constants/depot";

const MAX_BIKES_ON_VAN = 10;
const MAX_ROUTE_DISTANCE_MILES = 600;
const MIN_STOPS_PER_ROUTE = 10;
const DEPOT = DEPOT_LOCATION;

// Working days: Mon-Thu + Sat-Sun (Friday removed)
const WORKING_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'saturday', 'sunday'] as const;
const DAY_INDICES = [0, 1, 2, 3, 5, 6]; // addDays indices from Monday

export type UnderMinimumAction = 'defer' | 'combine';

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

export interface DeferredJob extends Job {
  originalDay: string;
  reason: string;
}

export interface WeeklyPlan {
  weekStart: Date;
  weekEnd: Date;
  days: DayPlan[];
  driversPerDay: Record<string, number>;
  deferredJobs: DeferredJob[];
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

// Enforce minimum stops per route - returns routes that don't meet minimum
const findUnderMinimumRoutes = (dayPlans: DayPlan[]): { dayIdx: number; driverIdx: number; driver: DriverAssignment }[] => {
  const underMinimum: { dayIdx: number; driverIdx: number; driver: DriverAssignment }[] = [];
  
  dayPlans.forEach((dayPlan, dayIdx) => {
    dayPlan.drivers.forEach((driver, driverIdx) => {
      if (driver.jobs.length > 0 && driver.jobs.length < MIN_STOPS_PER_ROUTE) {
        underMinimum.push({ dayIdx, driverIdx, driver });
      }
    });
  });
  
  return underMinimum;
};

// Handle routes under minimum by deferring jobs to later days
const handleUnderMinimumDefer = (
  dayPlans: DayPlan[],
  underMinimumRoutes: { dayIdx: number; driverIdx: number; driver: DriverAssignment }[]
): { updatedPlans: DayPlan[]; deferredJobs: DeferredJob[] } => {
  const deferredJobs: DeferredJob[] = [];
  const updatedPlans = [...dayPlans];
  
  // Sort by day index so we process earlier days first (defer to later days)
  underMinimumRoutes.sort((a, b) => a.dayIdx - b.dayIdx);
  
  underMinimumRoutes.forEach(({ dayIdx, driverIdx, driver }) => {
    const dayName = WORKING_DAYS[dayIdx];
    
    // Find a later day with enough jobs to absorb these + still meet minimum
    let absorbed = false;
    
    for (let laterDayIdx = dayIdx + 1; laterDayIdx < WORKING_DAYS.length && !absorbed; laterDayIdx++) {
      const laterDayPlan = updatedPlans[laterDayIdx];
      
      // Check if any driver on later day can absorb these jobs
      for (const laterDriver of laterDayPlan.drivers) {
        const combinedJobs = [...laterDriver.jobs, ...driver.jobs];
        const peakBikes = calculatePeakBikeCount(combinedJobs);
        const testDistance = calculateRouteDistance(combinedJobs);
        
        if (peakBikes <= MAX_BIKES_ON_VAN && testDistance <= MAX_ROUTE_DISTANCE_MILES) {
          // Absorb into this driver
          laterDriver.jobs.push(...driver.jobs);
          laterDriver.estimatedDistance = calculateRouteDistance(laterDriver.jobs);
          absorbed = true;
          break;
        }
      }
      
      // If no existing driver can absorb, add as new driver on later day if total would meet minimum
      if (!absorbed) {
        const laterDayTotalJobs = laterDayPlan.drivers.reduce((sum, d) => sum + d.jobs.length, 0);
        if (laterDayTotalJobs + driver.jobs.length >= MIN_STOPS_PER_ROUTE) {
          laterDayPlan.drivers.push({
            ...driver,
            driverIndex: laterDayPlan.drivers.length
          });
          absorbed = true;
        }
      }
    }
    
    // If couldn't absorb into later days, mark as deferred
    if (!absorbed) {
      driver.jobs.forEach(job => {
        deferredJobs.push({
          ...job,
          originalDay: dayName,
          reason: `Only ${driver.jobs.length} stops scheduled (minimum ${MIN_STOPS_PER_ROUTE} required)`
        });
      });
    }
    
    // Remove the under-minimum driver from original day
    updatedPlans[dayIdx].drivers = updatedPlans[dayIdx].drivers.filter((_, idx) => idx !== driverIdx);
  });
  
  // Recalculate totals
  updatedPlans.forEach(dayPlan => {
    dayPlan.totalJobs = dayPlan.drivers.reduce((sum, d) => sum + d.jobs.length, 0);
    dayPlan.totalDistance = dayPlan.drivers.reduce((sum, d) => sum + d.estimatedDistance, 0);
    // Re-index drivers
    dayPlan.drivers.forEach((d, idx) => { d.driverIndex = idx; });
  });
  
  return { updatedPlans, deferredJobs };
};

// Handle routes under minimum by combining across regions
const handleUnderMinimumCombine = (
  dayPlans: DayPlan[],
  underMinimumRoutes: { dayIdx: number; driverIdx: number; driver: DriverAssignment }[]
): { updatedPlans: DayPlan[]; deferredJobs: DeferredJob[] } => {
  const deferredJobs: DeferredJob[] = [];
  const updatedPlans = [...dayPlans];
  
  // Group under-minimum routes by day
  const byDay = new Map<number, { driverIdx: number; driver: DriverAssignment }[]>();
  underMinimumRoutes.forEach(item => {
    const existing = byDay.get(item.dayIdx) || [];
    existing.push({ driverIdx: item.driverIdx, driver: item.driver });
    byDay.set(item.dayIdx, existing);
  });
  
  byDay.forEach((driversToMerge, dayIdx) => {
    const dayPlan = updatedPlans[dayIdx];
    const dayName = WORKING_DAYS[dayIdx];
    
    // Collect all jobs from under-minimum routes
    const jobsToMerge: Job[] = [];
    const driverIndicesToRemove: number[] = [];
    
    driversToMerge.forEach(({ driverIdx, driver }) => {
      jobsToMerge.push(...driver.jobs);
      driverIndicesToRemove.push(driverIdx);
    });
    
    // Also collect jobs from routes that already meet minimum (to combine with)
    const existingMeetingMinimum = dayPlan.drivers.filter((d, idx) => 
      !driverIndicesToRemove.includes(idx) && d.jobs.length >= MIN_STOPS_PER_ROUTE
    );
    
    // Try to absorb into existing routes first
    let remainingJobs = [...jobsToMerge];
    
    existingMeetingMinimum.forEach(driver => {
      const absorbable: Job[] = [];
      remainingJobs = remainingJobs.filter(job => {
        const testJobs = [...driver.jobs, ...absorbable, job];
        const peakBikes = calculatePeakBikeCount(testJobs);
        const testDistance = calculateRouteDistance(testJobs);
        
        if (peakBikes <= MAX_BIKES_ON_VAN && testDistance <= MAX_ROUTE_DISTANCE_MILES) {
          absorbable.push(job);
          return false;
        }
        return true;
      });
      
      driver.jobs.push(...absorbable);
      driver.estimatedDistance = calculateRouteDistance(driver.jobs);
    });
    
    // Create new combined routes from remaining jobs
    if (remainingJobs.length >= MIN_STOPS_PER_ROUTE) {
      // Sort by distance from depot for better grouping
      remainingJobs.sort((a, b) => {
        const distA = calculateDistance(DEPOT.lat, DEPOT.lon, a.lat, a.lon);
        const distB = calculateDistance(DEPOT.lat, DEPOT.lon, b.lat, b.lon);
        return distA - distB;
      });
      
      // Create new drivers with combined routes
      let currentDriver: DriverAssignment = {
        driverIndex: dayPlan.drivers.length,
        jobs: [],
        estimatedDistance: 0,
        region: undefined
      };
      const newDrivers: DriverAssignment[] = [];
      
      remainingJobs.forEach(job => {
        const testJobs = [...currentDriver.jobs, job];
        const peakBikes = calculatePeakBikeCount(testJobs);
        const testDistance = calculateRouteDistance(testJobs);
        
        if (peakBikes <= MAX_BIKES_ON_VAN && testDistance <= MAX_ROUTE_DISTANCE_MILES) {
          currentDriver.jobs.push(job);
          currentDriver.estimatedDistance = testDistance;
        } else {
          // Start new driver
          if (currentDriver.jobs.length > 0) {
            newDrivers.push(currentDriver);
          }
          currentDriver = {
            driverIndex: dayPlan.drivers.length + newDrivers.length,
            jobs: [job],
            estimatedDistance: calculateRouteDistance([job]),
            region: job.region
          };
        }
      });
      
      if (currentDriver.jobs.length > 0) {
        newDrivers.push(currentDriver);
      }
      
      // Filter out new drivers that still don't meet minimum (defer those)
      newDrivers.forEach(driver => {
        if (driver.jobs.length >= MIN_STOPS_PER_ROUTE) {
          dayPlan.drivers.push(driver);
        } else {
          driver.jobs.forEach(job => {
            deferredJobs.push({
              ...job,
              originalDay: dayName,
              reason: `Combined route still only has ${driver.jobs.length} stops (minimum ${MIN_STOPS_PER_ROUTE} required)`
            });
          });
        }
      });
    } else if (remainingJobs.length > 0) {
      // Not enough to create a valid route - defer all
      remainingJobs.forEach(job => {
        deferredJobs.push({
          ...job,
          originalDay: dayName,
          reason: `Only ${remainingJobs.length} jobs available to combine (minimum ${MIN_STOPS_PER_ROUTE} required)`
        });
      });
    }
    
    // Remove original under-minimum drivers (sort indices descending to avoid shifting issues)
    driverIndicesToRemove.sort((a, b) => b - a).forEach(idx => {
      dayPlan.drivers.splice(idx, 1);
    });
  });
  
  // Recalculate totals
  updatedPlans.forEach(dayPlan => {
    dayPlan.totalJobs = dayPlan.drivers.reduce((sum, d) => sum + d.jobs.length, 0);
    dayPlan.totalDistance = dayPlan.drivers.reduce((sum, d) => sum + d.estimatedDistance, 0);
    // Re-index drivers
    dayPlan.drivers.forEach((d, idx) => { d.driverIndex = idx; });
  });
  
  return { updatedPlans, deferredJobs };
};

// Assign orders to week with auto-calculated drivers
export const assignOrdersToWeek = (
  orders: OrderData[],
  weekStart: Date,
  underMinimumAction: UnderMinimumAction = 'defer'
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
  let finalDayPlans = enforceCollectionBeforeDelivery(dayPlans, orders);
  
  // Step 6: Handle routes under minimum stops
  const underMinimumRoutes = findUnderMinimumRoutes(finalDayPlans);
  let deferredJobs: DeferredJob[] = [];
  
  if (underMinimumRoutes.length > 0) {
    if (underMinimumAction === 'defer') {
      const result = handleUnderMinimumDefer(finalDayPlans, underMinimumRoutes);
      finalDayPlans = result.updatedPlans;
      deferredJobs = result.deferredJobs;
    } else {
      const result = handleUnderMinimumCombine(finalDayPlans, underMinimumRoutes);
      finalDayPlans = result.updatedPlans;
      deferredJobs = result.deferredJobs;
    }
  }
  
  // Step 7: Recalculate driversPerDay based on actual assignments
  WORKING_DAYS.forEach((dayName, dayIdx) => {
    driversPerDay[dayName] = finalDayPlans[dayIdx].drivers.length;
  });
  
  return {
    weekStart,
    weekEnd: endOfWeek(weekStart, { weekStartsOn: 1 }),
    days: finalDayPlans,
    driversPerDay,
    deferredJobs,
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
      deferredJobs: [], // Saved plans don't have deferred jobs tracked
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
