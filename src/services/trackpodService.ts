import { Order } from "@/types/order";
import { toast } from "sonner";

const TRACKPOD_API_BASE = "https://api.track-pod.com";
const TRACKPOD_API_KEY = "70e39919-90bb-43cd-b69d-9ab9d1bffef0";

interface TrackPodOrder {
  Number: string;
  Type: number; // 0 = delivery, 1 = pickup
  Date: string;
  Client: string;
  Address: string;
  AddressLat?: number;
  AddressLon?: number;
  ContactName: string;
  Phone: string;
  Email: string;
  Note?: string;
  TimeSlotFrom?: string;
  TimeSlotTo?: string;
  ServiceTime?: number;
  Weight?: number;
  Volume?: number;
  Barcode?: string;
  GoodsList?: Array<{
    GoodsName: string;
    GoodsUnit: string;
    Quantity: number;
    Note?: string;
  }>;
}

/**
 * Converts an internal Order to Track-POD format
 */
export const convertOrderToTrackPodFormat = (order: Order): TrackPodOrder[] => {
  const orders: TrackPodOrder[] = [];
  const baseDate = new Date().toISOString().split('T')[0] + 'T00:00:00';

  // Create pickup order
  const pickupOrder: TrackPodOrder = {
    Number: `${order.trackingNumber || order.id}-PICKUP`,
    Type: 1, // Pickup
    Date: baseDate,
    Client: order.sender.name,
    Address: `${order.sender.address.street}, ${order.sender.address.city}, ${order.sender.address.state} ${order.sender.address.zipCode}, ${order.sender.address.country}`,
    AddressLat: order.sender.address.lat,
    AddressLon: order.sender.address.lon,
    ContactName: order.sender.name,
    Phone: order.sender.phone,
    Email: order.sender.email,
    Note: `Pickup for ${order.bikeBrand} ${order.bikeModel}${order.senderNotes ? ` - ${order.senderNotes}` : ''}`,
    ServiceTime: 15, // 15 minutes service time
    GoodsList: [{
      GoodsName: `${order.bikeBrand} ${order.bikeModel}`,
      GoodsUnit: "pcs",
      Quantity: 1,
      Note: order.customerOrderNumber || ""
    }]
  };

  // Create delivery order
  const deliveryOrder: TrackPodOrder = {
    Number: `${order.trackingNumber || order.id}-DELIVERY`,
    Type: 0, // Delivery
    Date: baseDate,
    Client: order.receiver.name,
    Address: `${order.receiver.address.street}, ${order.receiver.address.city}, ${order.receiver.address.state} ${order.receiver.address.zipCode}, ${order.receiver.address.country}`,
    AddressLat: order.receiver.address.lat,
    AddressLon: order.receiver.address.lon,
    ContactName: order.receiver.name,
    Phone: order.receiver.phone,
    Email: order.receiver.email,
    Note: `Delivery for ${order.bikeBrand} ${order.bikeModel}${order.deliveryInstructions ? ` - ${order.deliveryInstructions}` : ''}${order.receiverNotes ? ` - ${order.receiverNotes}` : ''}`,
    ServiceTime: 15, // 15 minutes service time
    GoodsList: [{
      GoodsName: `${order.bikeBrand} ${order.bikeModel}`,
      GoodsUnit: "pcs",
      Quantity: 1,
      Note: order.customerOrderNumber || ""
    }]
  };

  // Add time slots if scheduled dates exist
  if (order.scheduledPickupDate) {
    const pickupDate = new Date(order.scheduledPickupDate);
    pickupOrder.TimeSlotFrom = pickupDate.toISOString();
    const pickupEndTime = new Date(pickupDate.getTime() + 3 * 60 * 60 * 1000); // +3 hours
    pickupOrder.TimeSlotTo = pickupEndTime.toISOString();
  }

  if (order.scheduledDeliveryDate) {
    const deliveryDate = new Date(order.scheduledDeliveryDate);
    deliveryOrder.TimeSlotFrom = deliveryDate.toISOString();
    const deliveryEndTime = new Date(deliveryDate.getTime() + 3 * 60 * 60 * 1000); // +3 hours
    deliveryOrder.TimeSlotTo = deliveryEndTime.toISOString();
  }

  orders.push(pickupOrder, deliveryOrder);
  return orders;
};

/**
 * Creates orders in Track-POD
 */
export const createTrackPodOrders = async (trackPodOrders: TrackPodOrder[]): Promise<boolean> => {
  try {
    console.log('Creating Track-POD orders:', trackPodOrders);

    // Send orders in batches (Track-POD supports bulk creation)
    const batchSize = 50; // Reasonable batch size
    let successCount = 0;
    let totalCount = trackPodOrders.length;

    for (let i = 0; i < trackPodOrders.length; i += batchSize) {
      const batch = trackPodOrders.slice(i, i + batchSize);
      
      try {
        const response = await fetch(`${TRACKPOD_API_BASE}/Order/Bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': TRACKPOD_API_KEY,
            'Accept': 'application/json'
          },
          body: JSON.stringify(batch)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Track-POD API error for batch ${i / batchSize + 1}:`, {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          toast.error(`Track-POD API error: ${response.status} ${response.statusText}`);
          continue;
        }

        const result = await response.json();
        console.log(`Track-POD batch ${i / batchSize + 1} response:`, result);
        successCount += batch.length;
        
      } catch (error) {
        console.error(`Error creating Track-POD batch ${i / batchSize + 1}:`, error);
        toast.error(`Error creating Track-POD batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully synced ${successCount} orders to Track-POD`);
      return true;
    } else {
      toast.error("Failed to sync any orders to Track-POD");
      return false;
    }

  } catch (error) {
    console.error('Error in Track-POD sync:', error);
    toast.error(`Track-POD sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

/**
 * Filters and syncs eligible orders to Track-POD
 */
export const syncOrdersToTrackPod = async (orders: Order[]): Promise<boolean> => {
  try {
    // Filter orders that are eligible for Track-POD sync
    // Only sync orders that have been scheduled and have address coordinates
    const eligibleOrders = orders.filter(order => {
      return (
        (order.status === 'scheduled' || 
         order.status === 'driver_to_collection' || 
         order.status === 'collected' || 
         order.status === 'driver_to_delivery' || 
         order.status === 'delivered') &&
        order.sender?.address?.lat && 
        order.sender?.address?.lon &&
        order.receiver?.address?.lat && 
        order.receiver?.address?.lon &&
        order.bikeBrand && 
        order.bikeModel
      );
    });

    if (eligibleOrders.length === 0) {
      toast.info("No eligible orders found for Track-POD sync");
      return false;
    }

    console.log(`Found ${eligibleOrders.length} eligible orders for Track-POD sync`);

    // Convert orders to Track-POD format
    const trackPodOrders: TrackPodOrder[] = [];
    for (const order of eligibleOrders) {
      const convertedOrders = convertOrderToTrackPodFormat(order);
      trackPodOrders.push(...convertedOrders);
    }

    console.log(`Converted to ${trackPodOrders.length} Track-POD orders`);

    // Create orders in Track-POD
    const success = await createTrackPodOrders(trackPodOrders);
    return success;

  } catch (error) {
    console.error('Error in syncOrdersToTrackPod:', error);
    toast.error(`Sync to Track-POD failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};