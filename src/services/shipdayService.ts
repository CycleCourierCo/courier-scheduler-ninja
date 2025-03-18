
import { supabase } from "@/integrations/supabase/client";

/**
 * Creates shipments in Shipday for the given order
 * Creates two orders - one for pickup and one for delivery
 * 
 * @param orderId The ID of the order to create shipments for
 * @returns The response from the Shipday API
 */
export const createShipdayOrder = async (orderId: string) => {
  try {
    // Call the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke("create-shipday-order", {
      body: { orderId }
    });

    if (error) {
      console.error("Error creating Shipday orders:", error);
      throw new Error(error.message);
    }

    if (!data.success) {
      console.error("Failed to create Shipday orders:", data);
      throw new Error(data.error || "Unknown error creating Shipday orders");
    }

    return data;
  } catch (err) {
    console.error("Error in createShipdayOrder:", err);
    throw err;
  }
};
