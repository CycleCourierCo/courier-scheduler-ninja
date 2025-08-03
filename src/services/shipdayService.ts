
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
 * Syncs multiple orders to Shipday
 * @param orders Array of orders to sync to Shipday
 */
export const syncOrdersToShipday = async (orders: any[]) => {
  try {
    toast.info(`Starting Shipday sync for ${orders.length} orders...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const order of orders) {
      try {
        await createShipdayOrder(order.id);
        successCount++;
      } catch (error) {
        console.error(`Failed to sync order ${order.id} to Shipday:`, error);
        errorCount++;
      }
    }
    
    if (errorCount === 0) {
      toast.success(`Successfully synced ${successCount} orders to Shipday`);
    } else {
      toast.warning(`Synced ${successCount} orders to Shipday, ${errorCount} failed`);
    }
    
    return { successCount, errorCount };
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
