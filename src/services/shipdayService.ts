
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

/**
 * Tests the Shipday webhook with a simulated status update
 * This is for testing purposes only and should not be used in production
 * 
 * @param orderId The ID of the order to test the webhook for
 * @param shipdayId The Shipday ID (pickup_id or delivery_id)
 * @param status The status to simulate
 * @returns The response from the webhook
 */
export const testShipdayWebhook = async (
  orderId: string, 
  shipdayId: string, 
  status: 'on-the-way' | 'picked-up' | 'delivered'
) => {
  try {
    // Call the webhook directly for testing
    const { data, error } = await supabase.functions.invoke("shipday-webhook", {
      body: { 
        orderId: shipdayId, 
        status,
        timestamp: new Date().toISOString()
      },
      headers: {
        'x-webhook-token': 'test-token' // This should match what's set in the webhook function
      }
    });

    if (error) {
      console.error("Error testing Shipday webhook:", error);
      toast.error("Failed to test Shipday webhook");
      throw new Error(error.message);
    }

    toast.success(`Webhook test successful: Status updated to ${status}`);
    return data;
  } catch (err) {
    console.error("Error in testShipdayWebhook:", err);
    toast.error("An unexpected error occurred");
    throw err;
  }
};
