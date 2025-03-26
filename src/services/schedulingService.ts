
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
  type: 'pickup' | 'delivery'; // Added type to distinguish between pickup and delivery
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
      .in("status", ["scheduled_dates_pending", "pending_approval", "scheduled"])
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

// Function to group orders by location proximity for either pickup or delivery
export const groupOrdersByLocation = (orders: Order[], type: 'pickup' | 'delivery' = 'pickup'): SchedulingGroup[] => {
  if (!orders || orders.length === 0) {
    console.log("No orders to group");
    return [];
  }
  
  console.log(`Grouping ${orders.length} orders by location proximity for ${type}`);
  const groups: SchedulingGroup[] = [];
  const processedOrders = new Set<string>();
  
  // Create groups based on proximity
  orders.forEach(order => {
    if (processedOrders.has(`${order.id}-${type}`)) return;
    
    // For pickup, the contact is sender; for delivery, it's receiver
    const mainContact = type === 'pickup' ? order.sender : order.receiver;
    
    // Skip if we don't have location or date information
    if (!mainContact?.address?.zipCode || !order.pickupDate || !order.deliveryDate) {
      console.log(`Skipping order ${order.id} due to missing location or date information`);
      return;
    }
    
    // Ensure pickupDate and deliveryDate are arrays of Date objects
    const pickupDates = Array.isArray(order.pickupDate) 
      ? order.pickupDate.filter(d => d instanceof Date)
      : (order.pickupDate instanceof Date ? [order.pickupDate] : []);
      
    const deliveryDates = Array.isArray(order.deliveryDate) 
      ? order.deliveryDate.filter(d => d instanceof Date)
      : (order.deliveryDate instanceof Date ? [order.deliveryDate] : []);
    
    // Try to convert string dates if needed
    if (pickupDates.length === 0 && order.pickupDate) {
      const dates = Array.isArray(order.pickupDate) ? order.pickupDate : [order.pickupDate];
      dates.forEach(date => {
        if (typeof date === 'string') {
          try {
            pickupDates.push(new Date(date));
          } catch (e) {
            console.error(`Failed to parse pickup date: ${date}`, e);
          }
        }
      });
    }
    
    if (deliveryDates.length === 0 && order.deliveryDate) {
      const dates = Array.isArray(order.deliveryDate) ? order.deliveryDate : [order.deliveryDate];
      dates.forEach(date => {
        if (typeof date === 'string') {
          try {
            deliveryDates.push(new Date(date));
          } catch (e) {
            console.error(`Failed to parse delivery date: ${date}`, e);
          }
        }
      });
    }
    
    // Skip if no valid dates
    if (pickupDates.length === 0 || deliveryDates.length === 0) {
      console.log(`Skipping order ${order.id} due to no valid dates`);
      return;
    }
    
    // Get location name for group identification
    const locationName = getLocationName(mainContact);
    
    // Find if there's an existing group with locations in proximity
    let foundGroup = false;
    
    for (const group of groups) {
      // Only consider groups of the same type (pickup or delivery)
      if (group.type !== type) continue;
      
      // Check if any order in the group has a location close to this order
      const isProximityMatch = group.orders.some(existingOrder => {
        const existingContact = type === 'pickup' ? existingOrder.sender : existingOrder.receiver;
        return areLocationsWithinRadius(existingContact, mainContact);
      });
      
      if (isProximityMatch) {
        // Add to this group
        group.orders.push(order);
        console.log(`Added order ${order.id} to existing group ${group.id} (proximity match)`);
        processedOrders.add(`${order.id}-${type}`);
        foundGroup = true;
        break;
      }
    }
    
    if (!foundGroup) {
      // Create a new group
      const fromCity = type === 'pickup' 
        ? extractCity(order.sender.address)
        : extractCity(order.receiver.address);
        
      const toCity = type === 'pickup'
        ? extractCity(order.receiver.address)
        : extractCity(order.sender.address);
      
      const group: SchedulingGroup = {
        id: `${type}-group-${groups.length + 1}`,
        locationPair: {
          from: fromCity,
          to: toCity
        },
        dateRange: {
          pickup: pickupDates,
          delivery: deliveryDates
        },
        orders: [order],
        isOptimal: false,
        type: type
      };
      
      groups.push(group);
      console.log(`Created new group ${group.id} for ${locationName}`);
      processedOrders.add(`${order.id}-${type}`);
    }
  });
  
  console.log(`Created ${groups.length} ${type} order groups`);
  return groups;
};

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
      if (group.type === 'pickup') {
        // For pickup groups, we're setting the pickup date
        const deliveryDate = new Date(scheduleDate);
        deliveryDate.setDate(deliveryDate.getDate() + 1);
        return updateOrderScheduledDates(order.id, scheduleDate, deliveryDate);
      } else {
        // For delivery groups, we're setting the delivery date
        const pickupDate = new Date(scheduleDate);
        pickupDate.setDate(pickupDate.getDate() - 1);
        return updateOrderScheduledDates(order.id, pickupDate, scheduleDate);
      }
    });
    
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error("Error scheduling order group:", error);
    return false;
  }
};
