import { Order } from "@/types/order";
import { toast } from "sonner";

const OPTIMOROUTE_API_URL = "https://api.optimoroute.com/v1";
const OPTIMOROUTE_API_KEY = "093c894e7f3ec5c6152129c187902945pDSXE3kAn1Y";

interface OptimourouteOrder {
  orderNo: string;
  date: string;
  duration: number;
  type: "T" | "D"; // T = Transport/Pickup, D = Delivery
  location: {
    locationNo?: string;
    address: string;
    locationName: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
  };
  notes?: string;
  customField1?: string;
  customField2?: string;
  operation?: "MERGE" | "SYNC" | "CREATE" | "UPDATE";
  allowedDates?: any;
  blackoutDates?: any;
}

// Helper function to generate date restrictions in object format
const generateDateRestrictions = (order: Order) => {
  let allowedDatesObj: any = null;
  let blackoutDatesObj: any = null;
  
  if (order.pickupDate || order.deliveryDate) {
    const allowedDates: string[] = [];
    
    // Add pickup and delivery dates as allowed dates
    if (order.pickupDate) {
      if (Array.isArray(order.pickupDate)) {
        order.pickupDate.forEach(date => {
          allowedDates.push(new Date(date).toISOString().split('T')[0]);
        });
      } else {
        allowedDates.push(new Date(order.pickupDate).toISOString().split('T')[0]);
      }
    }
    
    if (order.deliveryDate) {
      if (Array.isArray(order.deliveryDate)) {
        order.deliveryDate.forEach(date => {
          allowedDates.push(new Date(date).toISOString().split('T')[0]);
        });
      } else {
        allowedDates.push(new Date(order.deliveryDate).toISOString().split('T')[0]);
      }
    }
    
    // Convert arrays to objects for OptimoRoute
    if (allowedDates.length > 0) {
      // Try different object formats that OptimoRoute might accept
      allowedDatesObj = {
        dates: allowedDates,
        type: "include"
      };
    }
    
    // Generate blackout dates for the next 30 days excluding allowed dates
    const blackoutDates: string[] = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      if (!allowedDates.includes(dateStr)) {
        blackoutDates.push(dateStr);
      }
    }
    
    if (blackoutDates.length > 0) {
      blackoutDatesObj = {
        dates: blackoutDates,
        type: "exclude"
      };
    }
  }
  
  return { allowedDatesObj, blackoutDatesObj };
};

// Convert internal order to OptimoRoute order format
const convertOrderToOptimoRouteFormat = (order: Order): OptimourouteOrder[] => {
  const orders: OptimourouteOrder[] = [];
  const baseDate = new Date().toISOString().split('T')[0]; // Use today's date as default
  
  // Generate date restrictions
  const { allowedDatesObj, blackoutDatesObj } = generateDateRestrictions(order);

  // Create pickup order (only if not already collected)
  const isCollected = order.status === 'collected' || order.status === 'driver_to_delivery' || order.status === 'delivered';
  
  if (order.sender?.address && !isCollected) {
    const pickupOrder: OptimourouteOrder = {
      orderNo: `${order.trackingNumber}-PICKUP`,
      date: baseDate,
      duration: 15, // 15 minutes for pickup
      type: "T", // Transport/Pickup
      location: {
        locationNo: `PICKUP-${order.id}`,
        address: `${order.sender.address.street}, ${order.sender.address.city}, ${order.sender.address.state} ${order.sender.address.zipCode}, ${order.sender.address.country}`,
        locationName: order.sender.name,
        latitude: order.sender.address.lat && order.sender.address.lat !== 0 ? order.sender.address.lat : undefined,
        longitude: order.sender.address.lon && order.sender.address.lon !== 0 ? order.sender.address.lon : undefined,
        notes: order.senderNotes || ""
      },
      notes: `Pickup for order ${order.trackingNumber}. Contact: ${order.sender.phone}. Bike: ${order.bikeBrand} ${order.bikeModel}`,
      customField1: order.id,
      customField2: "PICKUP",
      operation: "SYNC"
    };
    
    // Add date restrictions if available
    if (allowedDatesObj) {
      pickupOrder.allowedDates = allowedDatesObj;
    }
    if (blackoutDatesObj) {
      pickupOrder.blackoutDates = blackoutDatesObj;
    }
    
    orders.push(pickupOrder);
  }

  // Create delivery order
  if (order.receiver?.address) {
    const deliveryOrder: OptimourouteOrder = {
      orderNo: `${order.trackingNumber}-DELIVERY`,
      date: baseDate,
      duration: 15, // 15 minutes for delivery
      type: "D", // Delivery
      location: {
        locationNo: `DELIVERY-${order.id}`,
        address: `${order.receiver.address.street}, ${order.receiver.address.city}, ${order.receiver.address.state} ${order.receiver.address.zipCode}, ${order.receiver.address.country}`,
        locationName: order.receiver.name,
        latitude: order.receiver.address.lat && order.receiver.address.lat !== 0 ? order.receiver.address.lat : undefined,
        longitude: order.receiver.address.lon && order.receiver.address.lon !== 0 ? order.receiver.address.lon : undefined,
        notes: order.receiverNotes || ""
      },
      notes: `Delivery for order ${order.trackingNumber}. Bike: ${order.bikeBrand} ${order.bikeModel}. ${order.deliveryInstructions || ""}`,
      customField1: order.id,
      customField2: "DELIVERY",
      operation: "SYNC"
    };
    
    // Add date restrictions if available
    if (allowedDatesObj) {
      deliveryOrder.allowedDates = allowedDatesObj;
    }
    if (blackoutDatesObj) {
      deliveryOrder.blackoutDates = blackoutDatesObj;
    }
    
    // Always add the order (coordinates are optional, address is required)
    orders.push(deliveryOrder);
  }

  return orders;
};

// Sync orders to OptimoRoute
export const syncOrdersToOptimoRoute = async (orders: Order[]): Promise<boolean> => {
  try {
    // Filter orders that should be synced (exclude specific statuses)
    const excludedStatuses = ["scheduled", "driver_to_collection", "driver_to_delivery", "delivered", "cancelled"];
    const eligibleOrders = orders.filter(order => !excludedStatuses.includes(order.status));

    if (eligibleOrders.length === 0) {
      toast.info("No eligible orders to sync to OptimoRoute");
      return true;
    }

    console.log(`Syncing ${eligibleOrders.length} orders to OptimoRoute...`);

    // Convert all orders to OptimoRoute format
    const optimorouteOrders: OptimourouteOrder[] = [];
    eligibleOrders.forEach(order => {
      const convertedOrders = convertOrderToOptimoRouteFormat(order);
      optimorouteOrders.push(...convertedOrders);
    });

    if (optimorouteOrders.length === 0) {
      toast.warning("No valid orders to sync - missing address information");
      return false;
    }

    // Split into chunks of 500 orders (OptimoRoute limit)
    const chunks = [];
    for (let i = 0; i < optimorouteOrders.length; i += 500) {
      chunks.push(optimorouteOrders.slice(i, i + 500));
    }

    let totalSynced = 0;
    let totalErrors = 0;

    // Process each chunk
    for (const chunk of chunks) {
      try {
        const response = await fetch(`${OPTIMOROUTE_API_URL}/create_or_update_orders?key=${OPTIMOROUTE_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orders: chunk
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`OptimoRoute API error: ${response.status} - ${errorText}`);
          throw new Error(`OptimoRoute API error: ${response.status}`);
        }

        const result = await response.json();
        console.log("OptimoRoute response:", result);
        
        if (result.success) {
          // Count actual successes from individual order results
          let chunkSuccesses = 0;
          let chunkErrors = 0;
          
          if (result.orders && Array.isArray(result.orders)) {
            result.orders.forEach((orderResult: any, index: number) => {
              if (orderResult.success) {
                chunkSuccesses++;
                console.log(`✓ Order ${orderResult.orderNo} created successfully with ID: ${orderResult.id}`);
              } else {
                chunkErrors++;
                console.warn(`✗ Order ${chunk[index].orderNo} failed: ${orderResult.code} - ${orderResult.message}`);
              }
            });
          } else {
            // If no individual results, assume all succeeded
            chunkSuccesses = chunk.length;
          }
          
          console.log(`Chunk result: ${chunkSuccesses} successful, ${chunkErrors} failed out of ${chunk.length} orders`);
          totalSynced += chunkSuccesses;
          totalErrors += chunkErrors;
        } else {
          console.error("OptimoRoute sync failed for entire chunk:", result);
          totalErrors += chunk.length;
        }

      } catch (error) {
        console.error("Error syncing chunk to OptimoRoute:", error);
        totalErrors += chunk.length;
      }
    }

    if (totalSynced > 0) {
      toast.success(`Successfully synced ${totalSynced} orders to OptimoRoute`);
    }
    
    if (totalErrors > 0) {
      toast.error(`Failed to sync ${totalErrors} orders to OptimoRoute`);
    }

    return totalSynced > 0;

  } catch (error) {
    console.error("Error syncing orders to OptimoRoute:", error);
    toast.error("Failed to sync orders to OptimoRoute");
    return false;
  }
};

export default {
  syncOrdersToOptimoRoute
};