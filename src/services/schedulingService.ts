import { supabase } from "@/integrations/supabase/client";
import { Order } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";
import { updateOrderScheduledDates } from "./updateOrderService";
import { areLocationsWithinRadius, getLocationName } from "@/utils/locationUtils";

// Define types for our scheduling functionality
export type LocationPair = {
  from: string; // City name
  to: string; // City name
};

export type DateRange = {
  pickup: Date[];
  delivery: Date[];
};

export type SchedulingGroup = {
  id: string;
  locationPair: LocationPair;
  dateRange: DateRange;
  orders: Order[];
  isOptimal: boolean;
};

export type SchedulingJobGroup = {
  date: Date;
  groups: SchedulingGroup[];
};

// Function to get all pending orders that need scheduling and already scheduled orders
export const getPendingSchedulingOrders = async (): Promise<Order[]> => {
  try {
    console.log("Fetching pending scheduling orders and scheduled orders...");
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .in("status", [
        "scheduled_dates_pending", 
        "pending_approval", 
        "scheduled",
        "sender_availability_confirmed",
        "receiver_availability_confirmed"
      ])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error getting scheduling orders:", error);
      throw new Error(error.message);
    }

    console.log(`Found ${data.length} orders for scheduling`);
    const mappedOrders = data.map(mapDbOrderToOrderType);
    console.log("Mapped orders:", mappedOrders);
    return mappedOrders;
  } catch (error) {
    console.error("Unexpected error in getPendingSchedulingOrders:", error);
    throw error;
  }
};

// Function to extract city from an address
const extractCity = (address: any): string => {
  return address?.city || "Unknown";
};

// Find overlapping dates between two arrays of dates
const findOverlappingDates = (dates1: Date[], dates2: Date[]): Date[] => {
  const overlappingDates: Date[] = [];
  
  // Convert all dates to string format for easy comparison, but first ensure they are Date objects
  const stringDates1 = dates1.filter(d => d instanceof Date).map(d => d.toISOString().split('T')[0]);
  const stringDates2 = dates2.filter(d => d instanceof Date).map(d => d.toISOString().split('T')[0]);
  
  // Find common dates
  const commonDates = stringDates1.filter(date => stringDates2.includes(date));
  
  // Convert back to Date objects
  return commonDates.map(dateStr => new Date(dateStr));
};

// Function to group orders by location proximity
export const groupOrdersByLocation = (orders: Order[]): SchedulingGroup[] => {
  if (!orders || orders.length === 0) {
    console.log("No orders to group");
    return [];
  }
  
  console.log(`Grouping ${orders.length} orders by location proximity`);
  const groups: SchedulingGroup[] = [];
  const processedOrders = new Set<string>();
  
  // Create groups based on proximity
  orders.forEach(order => {
    // Skip already processed orders
    if (processedOrders.has(order.id)) {
      return;
    }
    
    // Use sender address as the main location point
    const mainContact = order.sender;
    
    // Skip if we don't have location or date information
    if (!mainContact?.address?.zipCode) {
      console.log(`Skipping order ${order.id} due to missing location information`);
      return;
    }
    
    // Process dates
    const pickupDates = processDateArray(order.pickupDate);
    const deliveryDates = processDateArray(order.deliveryDate);
    
    // Debug logging
    console.log(`Order ${order.id}: Pickup dates: ${pickupDates.length}, Delivery dates: ${deliveryDates.length}`);
    
    // Skip if no valid dates
    if (pickupDates.length === 0) {
      console.log(`Skipping order ${order.id} due to no valid pickup dates`);
      return;
    }
    
    // Get location name for group identification
    const locationName = getLocationName(mainContact);
    
    // Find if there's an existing group with locations in proximity
    let foundGroup = false;
    
    for (const group of groups) {
      // Check if any order in the group has a location close to this order
      const isProximityMatch = group.orders.some(existingOrder => {
        return areLocationsWithinRadius(existingOrder.sender, mainContact);
      });
      
      if (isProximityMatch) {
        // Add to this group, regardless of how many orders it already has
        group.orders.push(order);
        console.log(`Added order ${order.id} to existing group ${group.id} (proximity match)`);
        processedOrders.add(order.id);
        foundGroup = true;
        break;
      }
    }
    
    if (!foundGroup) {
      // Create a new group
      const fromCity = extractCity(order.sender.address);
      const toCity = extractCity(order.receiver.address);
      
      const group: SchedulingGroup = {
        id: `group-${groups.length + 1}`,
        locationPair: {
          from: fromCity,
          to: toCity
        },
        dateRange: {
          pickup: pickupDates,
          delivery: deliveryDates
        },
        orders: [order],
        isOptimal: false
      };
      
      groups.push(group);
      console.log(`Created new group ${group.id} for ${locationName}`);
      processedOrders.add(order.id);
    }
  });
  
  console.log(`Created ${groups.length} order groups`);
  return groups;
};

// Helper function to process dates from order data
function processDateArray(dateData: any): Date[] {
  if (!dateData) return [];
  
  // If it's already an array of Date objects
  if (Array.isArray(dateData) && dateData.every(d => d instanceof Date)) {
    return dateData;
  }
  
  // If it's a single Date object
  if (dateData instanceof Date) {
    return [dateData];
  }
  
  // If it's an array of strings or mixed types
  if (Array.isArray(dateData)) {
    const dates: Date[] = [];
    
    dateData.forEach(date => {
      if (date instanceof Date) {
        dates.push(date);
      } else if (typeof date === 'string') {
        try {
          const newDate = new Date(date);
          // Validate the date is valid
          if (!isNaN(newDate.getTime())) {
            dates.push(newDate);
          } else {
            console.error(`Invalid date string: ${date}`);
          }
        } catch (e) {
          console.error(`Failed to parse date: ${date}`, e);
        }
      }
    });
    
    return dates;
  }
  
  // If it's a string
  if (typeof dateData === 'string') {
    try {
      const newDate = new Date(dateData);
      // Validate the date is valid
      if (!isNaN(newDate.getTime())) {
        return [newDate];
      } else {
        console.error(`Invalid date string: ${dateData}`);
      }
    } catch (e) {
      console.error(`Failed to parse date: ${dateData}`, e);
    }
  }
  
  return [];
}

// Function to organize scheduling groups by dates
export const organizeGroupsByDates = (groups: SchedulingGroup[]): SchedulingJobGroup[] => {
  const dateGroupMap = new Map<string, SchedulingJobGroup>();
  
  groups.forEach(group => {
    // For each possible pickup date
    group.dateRange.pickup.forEach(pickupDate => {
      if (pickupDate instanceof Date) {
        const dateStr = pickupDate.toISOString().split('T')[0];
        
        if (!dateGroupMap.has(dateStr)) {
          dateGroupMap.set(dateStr, {
            date: new Date(dateStr),
            groups: []
          });
        }
        
        const jobGroup = dateGroupMap.get(dateStr)!;
        jobGroup.groups.push(group);
      }
    });
  });
  
  // Convert the map to an array and sort by date
  return Array.from(dateGroupMap.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
};

// Function to schedule a group of orders
export const scheduleOrderGroup = async (
  group: SchedulingGroup, 
  scheduleDate: Date
): Promise<boolean> => {
  try {
    const promises = group.orders.map(order => {
      // Set both pickup and delivery dates based on the scheduled date
      const deliveryDate = new Date(scheduleDate);
      deliveryDate.setDate(deliveryDate.getDate() + 1);
      return updateOrderScheduledDates(order.id, scheduleDate, deliveryDate);
    });
    
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error("Error scheduling order group:", error);
    return false;
  }
};
