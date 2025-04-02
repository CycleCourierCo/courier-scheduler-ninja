
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Creates shipments in Shipday for the given order
 * Simplified version with only the required fields for MVP
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
      toast.error("Failed to create Shipday order");
      throw new Error(error.message);
    }

    if (!data.success) {
      console.error("Failed to create Shipday orders:", data);
      toast.error(data.error || "Failed to create Shipday order");
      throw new Error(data.error || "Unknown error creating Shipday orders");
    }

    toast.success("Shipday order created successfully");
    return data;
  } catch (err) {
    console.error("Error in createShipdayOrder:", err);
    toast.error("An unexpected error occurred");
    throw err;
  }
};
