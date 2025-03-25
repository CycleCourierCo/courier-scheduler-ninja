
import { supabase } from "@/integrations/supabase/client";
import { Order } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";
import { updateOrderScheduledDates } from "./updateOrderService";

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

// Function to get all pending orders that need scheduling
export const getPendingSchedulingOrders = async (): Promise<Order[]> => {
  try {
    console.log("Fetching pending scheduling orders...");
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "scheduled_dates_pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error getting pending scheduling orders:", error);
      throw new Error(error.message);
    }

    console.log(`Found ${data.length} pending scheduling orders`);
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

// Function to group orders by location pairs and find optimal routes
export const groupOrdersByLocation = (orders: Order[]): SchedulingGroup[] => {
  if (!orders || orders.length === 0) {
    console.log("No orders to group");
    return [];
  }
  
  console.log(`Grouping ${orders.length} orders by location`);
  const groups: SchedulingGroup[] = [];
  const processedOrders = new Set<string>();
  
  // First pass: create initial groups based on direct from/to pairs
  orders.forEach(order => {
    if (processedOrders.has(order.id)) return;
    
    const fromCity = extractCity(order.sender.address);
    const toCity = extractCity(order.receiver.address);
    
    console.log(`Processing order ${order.id} from ${fromCity} to ${toCity}`);
    console.log("Order pickup dates:", order.pickupDate);
    console.log("Order delivery dates:", order.deliveryDate);
    
    // Skip if we don't have location or date information
    if (!fromCity || !toCity || !order.pickupDate || !order.deliveryDate) {
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
    
    console.log(`Order ${order.id} has ${pickupDates.length} pickup dates and ${deliveryDates.length} delivery dates`);
    
    // Create a new group for this location pair
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
    processedOrders.add(order.id);
    console.log(`Added order ${order.id} to group ${group.id}`);
  });
  
  // Second pass: try to chain groups to create optimal routes
  let optimizedGroups: SchedulingGroup[] = [...groups];
  let madeChanges = true;
  
  // Keep trying to optimize until no more changes can be made
  while (madeChanges) {
    madeChanges = false;
    
    for (let i = 0; i < optimizedGroups.length; i++) {
      const group1 = optimizedGroups[i];
      
      for (let j = 0; j < optimizedGroups.length; j++) {
        if (i === j) continue;
        
        const group2 = optimizedGroups[j];
        
        // Check if destination of group1 matches origin of group2
        if (group1.locationPair.to === group2.locationPair.from) {
          // Check if there are overlapping dates
          const overlappingDeliveryPickup = findOverlappingDates(
            group1.dateRange.delivery, 
            group2.dateRange.pickup
          );
          
          if (overlappingDeliveryPickup.length > 0) {
            // We can chain these groups
            const newGroup: SchedulingGroup = {
              id: `chain-${group1.id}-${group2.id}`,
              locationPair: {
                from: group1.locationPair.from,
                to: group2.locationPair.to
              },
              dateRange: {
                pickup: group1.dateRange.pickup,
                delivery: group2.dateRange.delivery
              },
              orders: [...group1.orders, ...group2.orders],
              isOptimal: true
            };
            
            // Remove the old groups and add the new one
            optimizedGroups = optimizedGroups.filter((_, index) => index !== i && index !== j);
            optimizedGroups.push(newGroup);
            
            madeChanges = true;
            break;
          }
        }
      }
      
      if (madeChanges) break;
    }
  }
  
  console.log(`Created ${optimizedGroups.length} order groups`);
  return optimizedGroups;
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
      // Calculate delivery date (for simplicity, delivery is 1 day after pickup)
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
