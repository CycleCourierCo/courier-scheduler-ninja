import { supabase } from "@/integrations/supabase/client";
import { Order, Address } from "@/types/order";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

// Types for jobs
export type JobType = 'collection' | 'delivery';
export type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

// Update Job type to match database structure
export type Job = {
  id: string;
  order_id: string;
  location: string;
  type: JobType;
  status?: JobStatus;
  related_job_id?: string;
  preferred_date?: string[] | Json;
  created_at: Date;
  updated_at: Date;
  lat?: number;
  lon?: number;
};

// Format address to string and extract lat/lon
const formatAddress = (address: Address): { addressString: string; lat?: number; lon?: number } => {
  const { street, city, state, zipCode, country, lat, lon } = address;
  return {
    addressString: `${street}, ${city}, ${state} ${zipCode}, ${country}`,
    lat,
    lon
  };
};

// Create jobs for an order after availability confirmation
export const createJobsForOrder = async (order: Order): Promise<boolean> => {
  try {
    // Check if jobs already exist for this order
    const { data: existingJobs, error: checkError } = await supabase
      .from("jobs")
      .select("id")
      .eq("order_id", order.id);
    
    if (checkError) throw checkError;
    
    // If jobs already exist, don't create duplicates
    if (existingJobs && existingJobs.length > 0) {
      console.log(`Jobs already exist for order ${order.id}`);
      return true;
    }
    
    // Create unique IDs for collection and delivery jobs
    const collectionId = crypto.randomUUID();
    const deliveryId = crypto.randomUUID();
    
    // Format addresses with coordinates
    const collectionAddress = formatAddress(order.sender.address);
    const deliveryAddress = formatAddress(order.receiver.address);
    
    // Format dates from the order
    const pickupDates = order.pickupDate instanceof Array ? 
      order.pickupDate.map(d => new Date(d).toISOString()) : 
      order.pickupDate ? [new Date(order.pickupDate).toISOString()] : [];
    
    const deliveryDates = order.deliveryDate instanceof Array ? 
      order.deliveryDate.map(d => new Date(d).toISOString()) : 
      order.deliveryDate ? [new Date(order.deliveryDate).toISOString()] : [];
    
    // Now we have added lat and lon to the jobs table
    const { error: insertError } = await supabase
      .from("jobs")
      .insert([
        {
          id: collectionId,
          order_id: order.id,
          location: collectionAddress.addressString,
          type: 'collection',
          status: 'pending',
          related_job_id: deliveryId,
          preferred_date: pickupDates,
          lat: collectionAddress.lat,
          lon: collectionAddress.lon
        },
        {
          id: deliveryId,
          order_id: order.id,
          location: deliveryAddress.addressString,
          type: 'delivery',
          status: 'pending',
          related_job_id: collectionId,
          preferred_date: deliveryDates,
          lat: deliveryAddress.lat,
          lon: deliveryAddress.lon
        }
      ]);
    
    if (insertError) throw insertError;
    
    console.log(`Successfully created jobs for order ${order.id}`);
    return true;
  } catch (error) {
    console.error("Error creating jobs for order:", error);
    toast.error(`Failed to create jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

// Get all jobs
export const getAllJobs = async (): Promise<Job[]> => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    
    return data.map(job => ({
      ...job,
      type: job.type as JobType,
      status: (job.status as JobStatus) || 'pending',
      created_at: new Date(job.created_at),
      updated_at: new Date(job.updated_at),
      // Make preferred_date compatible with both string[] and Json
      preferred_date: job.preferred_date
    }));
  } catch (error) {
    console.error("Error fetching jobs:", error);
    toast.error(`Failed to fetch jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
};

// Get jobs for a specific order
export const getJobsByOrderId = async (orderId: string): Promise<Job[]> => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("order_id", orderId)
      .order("type");
    
    if (error) throw error;
    
    return data.map(job => ({
      ...job,
      type: job.type as JobType,
      status: (job.status as JobStatus) || 'pending',
      created_at: new Date(job.created_at),
      updated_at: new Date(job.updated_at),
      // Make preferred_date compatible with both string[] and Json
      preferred_date: job.preferred_date
    }));
  } catch (error) {
    console.error(`Error fetching jobs for order ${orderId}:`, error);
    toast.error(`Failed to fetch jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
};

// Update job status based on order status
export const updateJobStatuses = async (orderId: string, orderStatus: string): Promise<boolean> => {
  try {
    // Map order status to appropriate job statuses
    let collectionStatus: JobStatus | null = null;
    let deliveryStatus: JobStatus | null = null;
    
    switch (orderStatus) {
      case 'scheduled':
        collectionStatus = 'scheduled';
        deliveryStatus = 'scheduled';
        break;
      case 'driver_to_collection':
        collectionStatus = 'in_progress';
        deliveryStatus = 'pending';
        break;
      case 'collected':
        collectionStatus = 'completed';
        deliveryStatus = 'pending';
        break;
      case 'driver_to_delivery':
        collectionStatus = 'completed';
        deliveryStatus = 'in_progress';
        break;
      case 'delivered':
        collectionStatus = 'completed';
        deliveryStatus = 'completed';
        break;
      default:
        return true; // No updates needed
    }
    
    // Update collection job
    if (collectionStatus) {
      const { error: collectionError } = await supabase
        .from("jobs")
        .update({ 
          status: collectionStatus 
        })
        .eq("order_id", orderId)
        .eq("type", 'collection');
      
      if (collectionError) throw collectionError;
    }
    
    // Update delivery job
    if (deliveryStatus) {
      const { error: deliveryError } = await supabase
        .from("jobs")
        .update({ 
          status: deliveryStatus 
        })
        .eq("order_id", orderId)
        .eq("type", 'delivery');
      
      if (deliveryError) throw deliveryError;
    }
    
    return true;
  } catch (error) {
    console.error(`Error updating job statuses for order ${orderId}:`, error);
    toast.error(`Failed to update job statuses: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

export default {
  createJobsForOrder,
  getAllJobs,
  getJobsByOrderId,
  updateJobStatuses
};
