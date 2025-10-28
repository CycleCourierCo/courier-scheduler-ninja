
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Creates shipments in Shipday for the given order
 * Simplified version with only the required fields for MVP
 * 
 * @param orderId The ID of the order to create shipments for
 * @param jobType Optional - specify 'pickup' or 'delivery' to create only that job type
 * @returns The response from the Shipday API
 */
/**
 * Syncs multiple orders to Shipday with status-based filtering
 * @param orders Array of orders to sync to Shipday
 */
export const syncOrdersToShipday = async (orders: any[]) => {
  try {
    // Filter orders based on status - exclude delivered and cancelled orders
    const ordersToSync = orders.filter(order => 
      order.status !== 'delivered' && order.status !== 'cancelled'
    );
    
    toast.info(`Starting Shipday sync for ${ordersToSync.length} orders...`);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = orders.length - ordersToSync.length;
    
    for (const order of ordersToSync) {
      try {
        // For collected orders, only create delivery
        if (order.status === 'collected') {
          await createShipdayOrder(order.id, 'delivery');
          successCount++;
        } else {
          // For all other orders, create both pickup and delivery
          await createShipdayOrder(order.id);
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to sync order ${order.id} to Shipday:`, error);
        errorCount++;
      }
    }
    
    let message = `Synced ${successCount} orders to Shipday`;
    if (errorCount > 0) {
      message += `, ${errorCount} failed`;
    }
    if (skippedCount > 0) {
      message += `, ${skippedCount} skipped (delivered/cancelled status)`;
    }
    
    if (errorCount === 0) {
      toast.success(message);
    } else {
      toast.warning(message);
    }
    
    return { successCount, errorCount, skippedCount };
  } catch (error) {
    console.error("Error during Shipday bulk sync:", error);
    toast.error("Failed to sync orders to Shipday");
    throw error;
  }
};

export const createShipdayOrder = async (orderId: string, jobType?: 'pickup' | 'delivery') => {
  try {
    // Call the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke("create-shipday-order", {
      body: { orderId, jobType }
    });

    if (error) {
      console.error("Error creating Shipday orders:", error);
      throw new Error(error.message);
    }

    if (!data || !data.success) {
      console.error("Failed to create Shipday orders:", data);
      throw new Error(data?.error || "Unknown error creating Shipday orders");
    }
    
    // Display helpful information about webhook setup
    console.log("Shipday order created. Configure the Shipday webhook:", {
      url: `https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/shipday-webhook`,
      message: "Note: Webhook token validation is currently disabled for initial setup."
    });
    
    return data;
  } catch (err) {
    console.error("Error in createShipdayOrder:", err);
    throw err;
  }
};

/**
 * Deletes Shipday pickup and delivery jobs for a given order
 * @param orderId The ID of the order to delete Shipday jobs for
 */
export const deleteShipdayJobs = async (orderId: string) => {
  try {
    console.log("Fetching order to delete Shipday jobs for:", orderId);
    
    // Fetch the order to get Shipday IDs
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('shipday_pickup_id, shipday_delivery_id')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      console.error("Error fetching order for Shipday deletion:", fetchError);
      throw new Error(fetchError.message);
    }

    const shipdayPickupId = order?.shipday_pickup_id;
    const shipdayDeliveryId = order?.shipday_delivery_id;

    // If no Shipday IDs exist, nothing to delete
    if (!shipdayPickupId && !shipdayDeliveryId) {
      console.log("No Shipday jobs found for order:", orderId);
      return { success: true, message: "No Shipday jobs to delete" };
    }

    console.log("Deleting Shipday jobs:", { shipdayPickupId, shipdayDeliveryId });

    // Call the edge function to delete Shipday jobs
    const { data, error } = await supabase.functions.invoke("delete-shipday-order", {
      body: { shipdayPickupId, shipdayDeliveryId }
    });

    if (error) {
      console.error("Error deleting Shipday jobs:", error);
      throw new Error(error.message);
    }

    if (!data || !data.success) {
      console.error("Failed to delete Shipday jobs:", data);
      const errorMsg = data?.result?.pickupError || data?.result?.deliveryError || "Unknown error";
      throw new Error(errorMsg);
    }

    console.log("Shipday jobs deletion result:", data.result);
    
    const deletedJobs = [];
    if (data.result.pickupDeleted) deletedJobs.push("pickup");
    if (data.result.deliveryDeleted) deletedJobs.push("delivery");
    
    const message = deletedJobs.length > 0 
      ? `Shipday ${deletedJobs.join(" and ")} job(s) deleted`
      : "Shipday jobs processed";
    
    return { success: true, message, result: data.result };
  } catch (err) {
    console.error("Error in deleteShipdayJobs:", err);
    throw err;
  }
};
