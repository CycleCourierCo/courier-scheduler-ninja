
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
    // Filter orders based on status
    const ordersToSync = orders.filter(order => order.status !== 'delivered');
    
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
      message += `, ${skippedCount} skipped (delivered status)`;
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
      toast.error("Failed to create Shipday order");
      throw new Error(error.message);
    }

    if (!data || !data.success) {
      console.error("Failed to create Shipday orders:", data);
      toast.error(data?.error || "Failed to create Shipday order");
      throw new Error(data?.error || "Unknown error creating Shipday orders");
    }

    toast.success("Shipday order created successfully");
    
    // Display helpful information about webhook setup
    console.log("Shipday order created. Configure the Shipday webhook:", {
      url: `https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/shipday-webhook`,
      message: "Note: Webhook token validation is currently disabled for initial setup."
    });
    
    return data;
  } catch (err) {
    console.error("Error in createShipdayOrder:", err);
    toast.error("An unexpected error occurred");
    throw err;
  }
};
