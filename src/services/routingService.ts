
import { supabase } from "@/integrations/supabase/client";
import { Order, Address } from "@/types/order";
import { toast } from "sonner";

// Types matching the backend API
type JobInput = {
  id: string;
  location: string;
  type: 'collection' | 'delivery';
  related_job_id?: string;
  preferred_date?: string[];
};

type DriverInput = {
  id: string;
  available_hours: number;
  name?: string;
  email?: string;
  phone?: string;
};

type OptimizationRequest = {
  jobs: JobInput[];
  drivers: DriverInput[];
  num_drivers_per_day: number;
};

type JobStop = {
  job_id: string;
  window: number[]; // [start_minute, end_minute]
};

type RouteOutput = {
  driver_id: string;
  day: number; // 1-5
  stops: JobStop[];
  total_time: number; // minutes
};

type OptimizationResponse = {
  routes: RouteOutput[];
  unassigned: string[];
};

// Configuration - replace with your deployed API URL and key
const ROUTING_API_URL = import.meta.env.VITE_ROUTING_API_URL || 'http://localhost:8000';
const ROUTING_API_KEY = import.meta.env.VITE_ROUTING_API_KEY || 'development_key';

// Format address to string for Google Maps API
const formatAddress = (address: Address): string => {
  const { street, city, state, zipCode, country } = address;
  return `${street}, ${city}, ${state} ${zipCode}, ${country}`;
};

// Convert order to job input 
const orderToJobs = (order: Order): JobInput[] => {
  // Create unique IDs for collection and delivery jobs
  const collectionId = `collection-${order.id}`;
  const deliveryId = `delivery-${order.id}`;
  
  // Create collection job
  const collectionJob: JobInput = {
    id: collectionId,
    location: formatAddress(order.sender.address),
    type: 'collection',
    related_job_id: deliveryId,
    preferred_date: order.pickupDate instanceof Array ? 
      order.pickupDate.map(d => new Date(d).toISOString()) : 
      order.pickupDate ? [new Date(order.pickupDate).toISOString()] : undefined
  };
  
  // Create delivery job
  const deliveryJob: JobInput = {
    id: deliveryId,
    location: formatAddress(order.receiver.address),
    type: 'delivery',
    related_job_id: collectionId,
    preferred_date: order.deliveryDate instanceof Array ? 
      order.deliveryDate.map(d => new Date(d).toISOString()) : 
      order.deliveryDate ? [new Date(order.deliveryDate).toISOString()] : undefined
  };
  
  return [collectionJob, deliveryJob];
};

// Helper function to parse JSON dates into Date objects
const parseJsonDates = (dateJson: any): Date[] | Date => {
  if (Array.isArray(dateJson)) {
    return dateJson.map(d => new Date(d));
  }
  return new Date(dateJson);
};

// Fetch orders and convert to jobs
export const fetchJobsFromOrders = async (): Promise<JobInput[]> => {
  try {
    // Fetch orders that need scheduling
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .in("status", [
        "scheduled_dates_pending", 
        "sender_availability_confirmed",
        "receiver_availability_confirmed"
      ]);
    
    if (error) throw error;
    
    // Convert orders to jobs
    const jobs: JobInput[] = [];
    orders.forEach(order => {
      // Properly type-cast the data from database to Order type
      const orderData: Order = {
        id: order.id,
        user_id: order.user_id,
        pickupDate: order.pickup_date ? parseJsonDates(order.pickup_date) : undefined,
        deliveryDate: order.delivery_date ? parseJsonDates(order.delivery_date) : undefined,
        sender: order.sender as (Order['sender']),
        receiver: order.receiver as (Order['receiver']),
        status: order.status,
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at),
        bikeBrand: order.bike_brand,
        bikeModel: order.bike_model,
        scheduledPickupDate: order.scheduled_pickup_date ? new Date(order.scheduled_pickup_date) : undefined,
        scheduledDeliveryDate: order.scheduled_delivery_date ? new Date(order.scheduled_delivery_date) : undefined,
        scheduledAt: order.scheduled_at ? new Date(order.scheduled_at) : undefined,
        trackingNumber: order.tracking_number,
        customerOrderNumber: order.customer_order_number,
        needsPaymentOnCollection: order.needs_payment_on_collection,
        isBikeSwap: order.is_bike_swap,
        deliveryInstructions: order.delivery_instructions,
        senderNotes: order.sender_notes,
        receiverNotes: order.receiver_notes,
        senderConfirmedAt: order.sender_confirmed_at ? new Date(order.sender_confirmed_at) : undefined,
        receiverConfirmedAt: order.receiver_confirmed_at ? new Date(order.receiver_confirmed_at) : undefined
      };
      
      const orderJobs = orderToJobs(orderData);
      jobs.push(...orderJobs);
    });
    
    return jobs;
  } catch (error) {
    console.error("Error fetching jobs from orders:", error);
    toast.error("Failed to fetch jobs for optimization");
    return [];
  }
};

// ----- API Functions for Jobs -----

export const createJob = async (job: JobInput): Promise<JobInput | null> => {
  try {
    const response = await fetch(`${ROUTING_API_URL}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': ROUTING_API_KEY
      },
      body: JSON.stringify(job)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to create job');
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error creating job:", error);
    toast.error(`Failed to create job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

export const fetchJobs = async (): Promise<JobInput[]> => {
  try {
    const response = await fetch(`${ROUTING_API_URL}/api/jobs`, {
      headers: {
        'X-API-KEY': ROUTING_API_KEY
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch jobs');
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching jobs:", error);
    toast.error(`Failed to fetch jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
};

export const updateJob = async (jobId: string, jobData: Partial<JobInput>): Promise<JobInput | null> => {
  try {
    const response = await fetch(`${ROUTING_API_URL}/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': ROUTING_API_KEY
      },
      body: JSON.stringify(jobData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update job');
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error updating job:", error);
    toast.error(`Failed to update job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

export const deleteJob = async (jobId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${ROUTING_API_URL}/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: {
        'X-API-KEY': ROUTING_API_KEY
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete job');
    }
    
    return true;
  } catch (error) {
    console.error("Error deleting job:", error);
    toast.error(`Failed to delete job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

// ----- API Functions for Drivers -----

export const fetchDrivers = async (): Promise<DriverInput[]> => {
  try {
    const response = await fetch(`${ROUTING_API_URL}/api/drivers`, {
      headers: {
        'X-API-KEY': ROUTING_API_KEY
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch drivers');
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching drivers:", error);
    toast.error(`Failed to fetch drivers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
};

export const createDriver = async (driver: DriverInput): Promise<DriverInput | null> => {
  try {
    const response = await fetch(`${ROUTING_API_URL}/api/drivers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': ROUTING_API_KEY
      },
      body: JSON.stringify(driver)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to create driver');
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error creating driver:", error);
    toast.error(`Failed to create driver: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

export const updateDriver = async (driverId: string, driverData: Partial<DriverInput>): Promise<DriverInput | null> => {
  try {
    const response = await fetch(`${ROUTING_API_URL}/api/drivers/${driverId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': ROUTING_API_KEY
      },
      body: JSON.stringify(driverData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update driver');
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error updating driver:", error);
    toast.error(`Failed to update driver: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

export const deleteDriver = async (driverId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${ROUTING_API_URL}/api/drivers/${driverId}`, {
      method: 'DELETE',
      headers: {
        'X-API-KEY': ROUTING_API_KEY
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete driver');
    }
    
    return true;
  } catch (error) {
    console.error("Error deleting driver:", error);
    toast.error(`Failed to delete driver: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

// ----- Optimization Function -----

export const optimizeRoutes = async (
  jobs: JobInput[],
  drivers: DriverInput[],
  numDriversPerDay: number
): Promise<OptimizationResponse | null> => {
  try {
    const request: OptimizationRequest = {
      jobs,
      drivers,
      num_drivers_per_day: numDriversPerDay
    };
    
    const response = await fetch(`${ROUTING_API_URL}/api/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': ROUTING_API_KEY
      },
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Route optimization failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error optimizing routes:", error);
    toast.error(`Route optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

// Save optimized routes to the database
export const saveOptimizedRoutes = async (optimizationResult: OptimizationResponse): Promise<boolean> => {
  try {
    // Create routes in the database
    const { error } = await (supabase as any)
      .from("routes")
      .insert(optimizationResult.routes.map(route => ({
        driver_id: route.driver_id,
        day: route.day,
        stops: route.stops,
        total_time: route.total_time
      })));
    
    if (error) throw error;
    
    // Create jobs in the database for monitoring
    const jobData = optimizationResult.routes.flatMap(route => 
      route.stops.map(stop => {
        // Extract order ID and job type from job ID
        // Format: "collection-{orderId}" or "delivery-{orderId}"
        const [type, orderId] = stop.job_id.split('-');
        
        return {
          id: stop.job_id,
          order_id: orderId,
          type: type,
          // More data will be added when we have the location info
        };
      })
    );
    
    if (jobData.length > 0) {
      const { error: jobsError } = await (supabase as any)
        .from("jobs")
        .insert(jobData);
      
      if (jobsError) throw jobsError;
    }
    
    toast.success("Routes optimized and saved successfully");
    return true;
  } catch (error) {
    console.error("Error saving optimized routes:", error);
    toast.error("Failed to save optimized routes");
    return false;
  }
};

// Run a full optimization job
export const runRouteOptimization = async (numDriversPerDay: number = 2): Promise<boolean> => {
  try {
    toast.info("Starting route optimization...");
    
    // 1. Fetch jobs from orders
    const jobs = await fetchJobsFromOrders();
    if (jobs.length === 0) {
      toast.info("No jobs available for optimization");
      return false;
    }
    
    // 2. Synchronize jobs with API
    for (const job of jobs) {
      await createJob(job);
    }
    
    // 3. Fetch drivers
    let drivers = await fetchDrivers();
    
    // If no drivers in API, fetch from Supabase and create them
    if (drivers.length === 0) {
      const { data: supabaseDrivers, error } = await (supabase as any)
        .from("drivers")
        .select("id, name, available_hours, email, phone");
      
      if (error) throw error;
      
      if (supabaseDrivers.length > 0) {
        for (const driver of supabaseDrivers) {
          await createDriver({
            id: driver.id,
            name: driver.name,
            available_hours: driver.available_hours || 9,
            email: driver.email,
            phone: driver.phone
          });
        }
        
        // Fetch again after creating
        drivers = await fetchDrivers();
      }
    }
    
    if (drivers.length === 0) {
      toast.error("No drivers available for optimization");
      return false;
    }
    
    // 4. Run optimization
    const optimizationResult = await optimizeRoutes(jobs, drivers, numDriversPerDay);
    if (!optimizationResult) {
      return false;
    }
    
    // 5. Save optimized routes
    return await saveOptimizedRoutes(optimizationResult);
  } catch (error) {
    console.error("Route optimization failed:", error);
    toast.error(`Route optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

// Export the service
export default {
  // Job API
  fetchJobs,
  createJob,
  updateJob,
  deleteJob,
  
  // Driver API
  fetchDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
  
  // Optimization
  optimizeRoutes,
  saveOptimizedRoutes,
  runRouteOptimization,
  
  // Utility
  fetchJobsFromOrders
};
