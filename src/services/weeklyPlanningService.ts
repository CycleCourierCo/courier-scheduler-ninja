import { OrderData } from "@/pages/JobScheduling";
import { format, addDays, isWithinInterval, startOfWeek, endOfWeek } from "date-fns";

export interface Job {
  orderId: string;
  type: 'collection' | 'delivery';
  contactName: string;
  address: string;
  phoneNumber: string;
  order: OrderData;
  lat: number;
  lon: number;
  availableDates: Date[];
}

export interface DriverAssignment {
  driverIndex: number;
  jobs: Job[];
  estimatedDistance: number;
}

export interface DayPlan {
  day: string;
  date: Date;
  drivers: DriverAssignment[];
  totalJobs: number;
}

export interface WeeklyPlan {
  weekStart: Date;
  weekEnd: Date;
  days: DayPlan[];
  driversPerDay: Record<string, number>;
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

// Group jobs by geographic proximity
const groupJobsByProximity = (jobs: Job[], maxDistanceKm: number = 30): Job[][] => {
  if (jobs.length === 0) return [];
  
  const clusters: Job[][] = [];
  const processed = new Set<string>();
  
  jobs.forEach(job => {
    if (processed.has(job.orderId + job.type)) return;
    
    const cluster: Job[] = [job];
    processed.add(job.orderId + job.type);
    
    // Find nearby jobs
    jobs.forEach(otherJob => {
      if (processed.has(otherJob.orderId + otherJob.type)) return;
      
      const distance = calculateDistance(
        job.lat, job.lon,
        otherJob.lat, otherJob.lon
      );
      
      if (distance <= maxDistanceKm) {
        cluster.push(otherJob);
        processed.add(otherJob.orderId + otherJob.type);
      }
    });
    
    clusters.push(cluster);
  });
  
  return clusters;
};

// Balance workload across drivers for a single day
export const balanceDriverWorkload = (
  dayJobs: Job[],
  numberOfDrivers: number,
  maxJobsPerDriver: number = 20
): DriverAssignment[] => {
  if (numberOfDrivers === 1) {
    return [{
      driverIndex: 0,
      jobs: dayJobs,
      estimatedDistance: 0
    }];
  }
  
  // Group jobs by proximity first
  const clusters = groupJobsByProximity(dayJobs, 25);
  
  // Initialize driver assignments
  const drivers: DriverAssignment[] = Array.from({ length: numberOfDrivers }, (_, i) => ({
    driverIndex: i,
    jobs: [],
    estimatedDistance: 0
  }));
  
  // Sort clusters by size (largest first) for better distribution
  clusters.sort((a, b) => b.length - a.length);
  
  // Assign clusters to drivers with least jobs
  clusters.forEach(cluster => {
    // Find driver with fewest jobs
    const driver = drivers.reduce((min, curr) => 
      curr.jobs.length < min.jobs.length ? curr : min
    );
    
    // Check if adding this cluster would exceed max jobs
    if (driver.jobs.length + cluster.length <= maxJobsPerDriver) {
      driver.jobs.push(...cluster);
    } else {
      // Split cluster if needed
      const available = maxJobsPerDriver - driver.jobs.length;
      driver.jobs.push(...cluster.slice(0, available));
      
      // Assign remaining to next driver
      const remaining = cluster.slice(available);
      const nextDriver = drivers.reduce((min, curr) => 
        curr.jobs.length < min.jobs.length && curr !== driver ? curr : min
      );
      nextDriver.jobs.push(...remaining);
    }
  });
  
  return drivers;
};

// Assign orders to week with multi-driver support
export const assignOrdersToWeek = (
  orders: OrderData[],
  weekStart: Date,
  driversPerDay: Record<string, number>
): WeeklyPlan => {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const dayPlans: DayPlan[] = [];
  
  // Create job list from orders
  const allJobs: (Job & { dayIndex: number })[] = [];
  
  orders.forEach(order => {
    // Collection job
    if (order.sender.address.lat && order.sender.address.lon) {
      const availableDays = getAvailableDaysForOrder(order, weekStart, true);
      
      availableDays.forEach(date => {
        const dayIndex = Math.floor((date.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
        if (dayIndex >= 0 && dayIndex < 5) {
          allJobs.push({
            orderId: order.id,
            type: 'collection',
            contactName: order.sender.name,
            address: `${order.sender.address.street}, ${order.sender.address.city}`,
            phoneNumber: order.sender.phone,
            order,
            lat: order.sender.address.lat,
            lon: order.sender.address.lon,
            availableDates: availableDays,
            dayIndex
          });
        }
      });
    }
    
    // Delivery job
    if (order.receiver.address.lat && order.receiver.address.lon) {
      const availableDays = getAvailableDaysForOrder(order, weekStart, false);
      
      availableDays.forEach(date => {
        const dayIndex = Math.floor((date.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
        if (dayIndex >= 0 && dayIndex < 5) {
          allJobs.push({
            orderId: order.id,
            type: 'delivery',
            contactName: order.receiver.name,
            address: `${order.receiver.address.street}, ${order.receiver.address.city}`,
            phoneNumber: order.receiver.phone,
            order,
            lat: order.receiver.address.lat,
            lon: order.receiver.address.lon,
            availableDates: availableDays,
            dayIndex
          });
        }
      });
    }
  });
  
  // Group jobs by day
  for (let i = 0; i < 5; i++) {
    const dayDate = addDays(weekStart, i);
    const dayName = days[i];
    const numDrivers = driversPerDay[dayName] || 1;
    
    // Get jobs for this day
    const dayJobs = allJobs
      .filter(job => job.dayIndex === i)
      .map(({ dayIndex, ...job }) => job);
    
    // Remove duplicates (same order might have multiple available days)
    const uniqueJobs = dayJobs.filter((job, index, self) => 
      index === self.findIndex(j => j.orderId === job.orderId && j.type === job.type)
    );
    
    // Balance across drivers
    const driverAssignments = balanceDriverWorkload(uniqueJobs, numDrivers);
    
    dayPlans.push({
      day: dayName,
      date: dayDate,
      drivers: driverAssignments,
      totalJobs: uniqueJobs.length
    });
  }
  
  return {
    weekStart,
    weekEnd: endOfWeek(weekStart, { weekStartsOn: 1 }),
    days: dayPlans,
    driversPerDay
  };
};

// Prioritize days by job count
export const prioritizeDays = (plan: WeeklyPlan): string[] => {
  return [...plan.days]
    .sort((a, b) => b.totalJobs - a.totalJobs)
    .map(day => day.day);
};
