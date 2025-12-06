import { OrderData } from "@/pages/JobScheduling";
import { format, addDays, isWithinInterval, startOfWeek, endOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { DEPOT_LOCATION } from "@/constants/depot";
import { clusterJobs, ClusterPoint, haversineDistance } from "./clusteringService";

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

export interface UnderMinimumRoute {
  dayName: string;
  dayIdx: number;
  driverIdx: number;
  driver: DriverAssignment;
}

export interface WeeklyPlan {
  weekStart: Date;
  weekEnd: Date;
  days: DayPlan[];
  driversPerDay: Record<string, number>;
  deferredJobs: DeferredJob[];
  underMinimumByDay: Record<string, UnderMinimumRoute[]>;
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
export const getJobsForOrder = (order: OrderData): ('collection' | 'delivery')[] => {
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

// Count jobs for a set of orders - used for consistent job counting across UI
export const countJobsForOrders = (orders: OrderData[]): { 
  total: number; 
  collections: number; 
  deliveries: number 
} => {
  let collections = 0;
  let deliveries = 0;
  
  orders.forEach(order => {
    const jobs = getJobsForOrder(order);
    if (jobs.includes('collection')) collections++;
    if (jobs.includes('delivery')) deliveries++;
  });
  
  return { total: collections + deliveries, collections, deliveries };
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

// Calculate required drivers for a set of jobs - prioritize 10-job minimum per route
export const calculateRequiredDrivers = (jobs: Job[]): number => {
  if (jobs.length === 0) return 0;
  
  // Primary constraint: minimum 10 jobs per route
  const driversByMinStops = Math.ceil(jobs.length / MIN_STOPS_PER_ROUTE);
  
  // Secondary: bike capacity (max 10 bikes on van at peak)
  const totalBikesToCollect = jobs
    .filter(j => j.type === 'collection')
    .reduce((sum, j) => sum + j.bikeQuantity, 0);
  const driversByBikeCapacity = Math.ceil(totalBikesToCollect / MAX_BIKES_ON_VAN);
  
  // Return the higher constraint (fewer routes = better, but must respect constraints)
  return Math.max(1, driversByMinStops, driversByBikeCapacity);
};

// Balance workload across drivers for a single day using K-Means clustering
export const balanceDriverWorkload = (
  dayJobs: Job[],
  numberOfDrivers: number
): DriverAssignment[] => {
  if (dayJobs.length === 0) return [];
  
  // Convert jobs to cluster points for K-Means
  const clusterPoints: ClusterPoint[] = dayJobs.map(job => ({
    id: `${job.orderId}-${job.type}`,
    lat: job.lat,
    lon: job.lon,
    type: job.type,
    orderId: job.orderId,
    bikeQuantity: job.bikeQuantity
  }));
  
  // Calculate optimal number of clusters prioritizing 10-job minimum
  // Target: each route should have at least MIN_STOPS_PER_ROUTE jobs
  const targetClusters = Math.max(1, Math.ceil(dayJobs.length / MIN_STOPS_PER_ROUTE));
  
  // Use K-Means clustering for geographic grouping
  const clusterResult = clusterJobs(clusterPoints, {
    maxBikesPerVan: MAX_BIKES_ON_VAN,
    maxDistancePerRoute: MAX_ROUTE_DISTANCE_MILES,
    forceK: targetClusters
  });
  
  // Convert clusters back to driver assignments
  const drivers: DriverAssignment[] = clusterResult.clusters.map((cluster, idx) => {
    // Find the original jobs for each cluster point
    const clusterJobsList: Job[] = cluster.points.map(point => {
      return dayJobs.find(job => 
        job.orderId === point.orderId && job.type === point.type
      )!;
    }).filter(Boolean);
    
    return {
      driverIndex: idx,
      jobs: clusterJobsList,
      estimatedDistance: calculateRouteDistance(clusterJobsList),
      region: undefined // K-Means handles geographic grouping, no fixed regions
    };
  });
  
  // Handle any outliers by adding to the nearest cluster that has capacity
  if (clusterResult.outliers.length > 0) {
    clusterResult.outliers.forEach(outlier => {
      const outlierJob = dayJobs.find(job => 
        job.orderId === outlier.orderId && job.type === outlier.type
      );
      
      if (outlierJob) {
        // Find nearest driver with capacity
        let bestDriver: DriverAssignment | null = null;
        let bestDistance = Infinity;
        
        for (const driver of drivers) {
          if (driver.jobs.length === 0) continue;
          
          // Check if can add (capacity constraints)
          const testJobs = [...driver.jobs, outlierJob];
          const peakBikes = calculatePeakBikeCount(testJobs);
          const testDistance = calculateRouteDistance(testJobs);
          
          if (peakBikes <= MAX_BIKES_ON_VAN && testDistance <= MAX_ROUTE_DISTANCE_MILES) {
            // Calculate distance to cluster centroid
            const centroidLat = driver.jobs.reduce((sum, j) => sum + j.lat, 0) / driver.jobs.length;
            const centroidLon = driver.jobs.reduce((sum, j) => sum + j.lon, 0) / driver.jobs.length;
            const dist = haversineDistance(outlierJob.lat, outlierJob.lon, centroidLat, centroidLon);
            
            if (dist < bestDistance) {
              bestDistance = dist;
              bestDriver = driver;
            }
          }
        }
        
        if (bestDriver) {
          bestDriver.jobs.push(outlierJob);
          bestDriver.estimatedDistance = calculateRouteDistance(bestDriver.jobs);
        } else {
          // Create new driver for outlier
          drivers.push({
            driverIndex: drivers.length,
            jobs: [outlierJob],
            estimatedDistance: calculateRouteDistance([outlierJob]),
            region: undefined
          });
        }
      }
    });
  }
  
  // Consolidate small routes to ensure all meet the 10-job minimum
  const consolidatedDrivers = consolidateSmallRoutes(drivers);
  
  return consolidatedDrivers;
};

// Consolidate routes with fewer than 10 jobs into nearby routes that have capacity
const consolidateSmallRoutes = (drivers: DriverAssignment[]): DriverAssignment[] => {
  if (drivers.length <= 1) return drivers;
  
  // Remove any empty drivers first
  let result = drivers.filter(d => d.jobs.length > 0);
  
  let consolidationMade = true;
  let iterations = 0;
  const maxIterations = 50; // Prevent infinite loops
  
  while (consolidationMade && iterations < maxIterations) {
    consolidationMade = false;
    iterations++;
    
    // Find the smallest route that's under the minimum
    const underMinIdx = result.findIndex(d => d.jobs.length < MIN_STOPS_PER_ROUTE);
    if (underMinIdx === -1) break; // All routes meet minimum
    
    const smallRoute = result[underMinIdx];
    
    // Calculate centroid of small route
    const smallCentroid = {
      lat: smallRoute.jobs.reduce((sum, j) => sum + j.lat, 0) / smallRoute.jobs.length,
      lon: smallRoute.jobs.reduce((sum, j) => sum + j.lon, 0) / smallRoute.jobs.length
    };
    
    // Find the nearest route that can absorb this one (respecting capacity constraints)
    let bestTargetIdx = -1;
    let bestDistance = Infinity;
    
    for (let i = 0; i < result.length; i++) {
      if (i === underMinIdx || result[i].jobs.length === 0) continue;
      
      const target = result[i];
      const combinedJobs = [...target.jobs, ...smallRoute.jobs];
      const peakBikes = calculatePeakBikeCount(combinedJobs);
      const combinedDistance = calculateRouteDistance(combinedJobs);
      
      // Check capacity constraints
      if (peakBikes <= MAX_BIKES_ON_VAN && combinedDistance <= MAX_ROUTE_DISTANCE_MILES) {
        const targetCentroid = {
          lat: target.jobs.reduce((sum, j) => sum + j.lat, 0) / target.jobs.length,
          lon: target.jobs.reduce((sum, j) => sum + j.lon, 0) / target.jobs.length
        };
        
        const dist = haversineDistance(smallCentroid.lat, smallCentroid.lon, 
                                       targetCentroid.lat, targetCentroid.lon);
        
        if (dist < bestDistance) {
          bestDistance = dist;
          bestTargetIdx = i;
        }
      }
    }
    
    if (bestTargetIdx !== -1) {
      // Merge small route into target
      result[bestTargetIdx].jobs.push(...smallRoute.jobs);
      result[bestTargetIdx].estimatedDistance = calculateRouteDistance(result[bestTargetIdx].jobs);
      result.splice(underMinIdx, 1);
      consolidationMade = true;
    } else {
      // Can't merge this route due to capacity limits
      // Move it to the end so we check other small routes first
      const [removed] = result.splice(underMinIdx, 1);
      result.push(removed);
      
      // If we've cycled through all under-minimum routes without merging, stop
      const allUnderMin = result.filter(d => d.jobs.length < MIN_STOPS_PER_ROUTE);
      if (allUnderMin.length === result.length) break; // All routes are under minimum and can't be merged
    }
  }
  
  // Re-index drivers
  result.forEach((d, idx) => { d.driverIndex = idx; });
  
  return result;
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

// Enforce minimum stops per route - returns routes that don't meet minimum grouped by day
const findUnderMinimumRoutes = (dayPlans: DayPlan[]): Record<string, UnderMinimumRoute[]> => {
  const underMinimumByDay: Record<string, UnderMinimumRoute[]> = {};
  
  dayPlans.forEach((dayPlan, dayIdx) => {
    const dayName = WORKING_DAYS[dayIdx];
    dayPlan.drivers.forEach((driver, driverIdx) => {
      if (driver.jobs.length > 0 && driver.jobs.length < MIN_STOPS_PER_ROUTE) {
        if (!underMinimumByDay[dayName]) {
          underMinimumByDay[dayName] = [];
        }
        underMinimumByDay[dayName].push({ dayName, dayIdx, driverIdx, driver });
      }
    });
  });
  
  return underMinimumByDay;
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
    
    // Collect driver indices to remove
    const driverIndicesToRemove = new Set<number>();
    driversToMerge.forEach(({ driverIdx }) => {
      driverIndicesToRemove.add(driverIdx);
    });
    
    // Separate existing drivers into valid (meeting minimum) and under-minimum
    const validDrivers: DriverAssignment[] = [];
    const allJobsFromUnderMinimum: Job[] = [];
    
    dayPlan.drivers.forEach((driver, idx) => {
      if (driverIndicesToRemove.has(idx)) {
        // This is an under-minimum route - collect its jobs
        allJobsFromUnderMinimum.push(...driver.jobs);
      } else {
        // Keep this driver as-is
        validDrivers.push(driver);
      }
    });
    
    // Sort jobs by distance from depot for better geographic grouping
    allJobsFromUnderMinimum.sort((a, b) => {
      const distA = calculateDistance(DEPOT.lat, DEPOT.lon, a.lat, a.lon);
      const distB = calculateDistance(DEPOT.lat, DEPOT.lon, b.lat, b.lon);
      return distA - distB;
    });
    
    // First, try to absorb jobs one-by-one into existing valid routes
    const remainingJobs: Job[] = [];
    
    allJobsFromUnderMinimum.forEach(job => {
      let absorbed = false;
      
      for (const driver of validDrivers) {
        const testJobs = [...driver.jobs, job];
        const peakBikes = calculatePeakBikeCount(testJobs);
        const testDistance = calculateRouteDistance(testJobs);
        
        if (peakBikes <= MAX_BIKES_ON_VAN && testDistance <= MAX_ROUTE_DISTANCE_MILES) {
          driver.jobs.push(job);
          driver.estimatedDistance = testDistance;
          absorbed = true;
          break;
        }
      }
      
      if (!absorbed) {
        remainingJobs.push(job);
      }
    });
    
    // Now create new combined routes from remaining jobs
    if (remainingJobs.length > 0) {
      // Build new routes respecting capacity limits
      const newRoutes: DriverAssignment[] = [];
      let currentRoute: DriverAssignment = {
        driverIndex: 0,
        jobs: [],
        estimatedDistance: 0,
        region: undefined
      };
      
      remainingJobs.forEach(job => {
        const testJobs = [...currentRoute.jobs, job];
        const peakBikes = calculatePeakBikeCount(testJobs);
        const testDistance = calculateRouteDistance(testJobs);
        
        if (peakBikes <= MAX_BIKES_ON_VAN && testDistance <= MAX_ROUTE_DISTANCE_MILES) {
          currentRoute.jobs.push(job);
          currentRoute.estimatedDistance = testDistance;
        } else {
          // Save current route and start a new one
          if (currentRoute.jobs.length > 0) {
            newRoutes.push(currentRoute);
          }
          currentRoute = {
            driverIndex: 0,
            jobs: [job],
            estimatedDistance: calculateRouteDistance([job]),
            region: job.region
          };
        }
      });
      
      if (currentRoute.jobs.length > 0) {
        newRoutes.push(currentRoute);
      }
      
      // For new routes: keep those meeting minimum, try to absorb others, or defer
      newRoutes.forEach(route => {
        if (route.jobs.length >= MIN_STOPS_PER_ROUTE) {
          // Route meets minimum - add to valid drivers
          validDrivers.push(route);
        } else {
          // Try to absorb these jobs into existing valid routes one-by-one
          route.jobs.forEach(job => {
            let absorbed = false;
            
            for (const driver of validDrivers) {
              const testJobs = [...driver.jobs, job];
              const peakBikes = calculatePeakBikeCount(testJobs);
              const testDistance = calculateRouteDistance(testJobs);
              
              if (peakBikes <= MAX_BIKES_ON_VAN && testDistance <= MAX_ROUTE_DISTANCE_MILES) {
                driver.jobs.push(job);
                driver.estimatedDistance = testDistance;
                absorbed = true;
                break;
              }
            }
            
            if (!absorbed) {
              deferredJobs.push({
                ...job,
                originalDay: dayName,
                reason: `Could not combine into a valid route (minimum ${MIN_STOPS_PER_ROUTE} stops required)`
              });
            }
          });
        }
      });
    }
    
    // Replace day's drivers with the new valid set
    dayPlan.drivers = validDrivers;
    
    // Re-index drivers
    dayPlan.drivers.forEach((d, idx) => { d.driverIndex = idx; });
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

// Handle under-minimum routes for a specific day and return updated plan
export const handleUnderMinimumForDay = (
  plan: WeeklyPlan,
  dayName: string,
  action: UnderMinimumAction
): WeeklyPlan => {
  const underMinimumRoutes = plan.underMinimumByDay[dayName];
  if (!underMinimumRoutes || underMinimumRoutes.length === 0) {
    return plan;
  }

  // Convert to the format expected by existing handlers
  const routesForHandler = underMinimumRoutes.map(r => ({
    dayIdx: r.dayIdx,
    driverIdx: r.driverIdx,
    driver: r.driver
  }));

  let result: { updatedPlans: DayPlan[]; deferredJobs: DeferredJob[] };
  
  if (action === 'defer') {
    result = handleUnderMinimumDefer([...plan.days], routesForHandler);
  } else {
    result = handleUnderMinimumCombine([...plan.days], routesForHandler);
  }

  // Recalculate driversPerDay
  const driversPerDay: Record<string, number> = {};
  WORKING_DAYS.forEach((day, dayIdx) => {
    driversPerDay[day] = result.updatedPlans[dayIdx].drivers.length;
  });

  // Recalculate underMinimumByDay
  const newUnderMinimumByDay = findUnderMinimumRoutes(result.updatedPlans);

  return {
    ...plan,
    days: result.updatedPlans,
    driversPerDay,
    deferredJobs: [...plan.deferredJobs, ...result.deferredJobs],
    underMinimumByDay: newUnderMinimumByDay
  };
};

// Assign orders to week with auto-calculated drivers
// Does NOT auto-apply under-minimum handling - that's done per-day via UI
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
  let finalDayPlans = enforceCollectionBeforeDelivery(dayPlans, orders);
  
  // Step 6: Identify routes under minimum stops (don't auto-handle, let UI decide)
  const underMinimumByDay = findUnderMinimumRoutes(finalDayPlans);
  
  // Step 7: Recalculate driversPerDay based on actual assignments
  WORKING_DAYS.forEach((dayName, dayIdx) => {
    driversPerDay[dayName] = finalDayPlans[dayIdx].drivers.length;
  });
  
  return {
    weekStart,
    weekEnd: endOfWeek(weekStart, { weekStartsOn: 1 }),
    days: finalDayPlans,
    driversPerDay,
    deferredJobs: [],
    underMinimumByDay,
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
      deferredJobs: [],
      underMinimumByDay: {},
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
