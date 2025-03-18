
import { supabase } from "@/integrations/supabase/client";

/**
 * Creates a shipment in Shipday for the given order
 * 
 * @param orderId The ID of the order to create a shipment for
 * @returns The response from the Shipday API
 */
export const createShipdayOrder = async (orderId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke("create-shipday-order", {
      body: { orderId }
    });

    if (error) {
      console.error("Error creating shipday order:", error);
      throw new Error(error.message);
    }

    return data;
  } catch (err) {
    console.error("Error in createShipdayOrder:", err);
    throw err;
  }
};
