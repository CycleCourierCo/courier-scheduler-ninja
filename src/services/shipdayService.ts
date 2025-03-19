
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
 * Tests the Shipday webhook by manually invoking the function
 * This is useful for debugging webhook issues
 * 
 * @param orderId The ID of the order to test
 * @param event The event type to simulate
 * @returns The response from the webhook function
 */
export const testShipdayWebhook = async (orderId: string, event: string = "ORDER_ONTHEWAY") => {
  try {
    // Create a mock webhook payload
    const mockPayload = {
      timestamp: Date.now(),
      event: event,
      order_status: "STARTED",
      order: {
        id: 12345,
        order_number: `${orderId}-PICKUP`,
        pickedup_time: Date.now(),
        eta: Date.now() + 3600000 // 1 hour in the future
      },
      company: { id: 1, name: "Test Company" },
      delivery_details: {},
      pickup_details: {}
    };

    // Call the webhook function directly
    const { data, error } = await supabase.functions.invoke("shipday-webhook", {
      body: mockPayload
    });

    if (error) {
      console.error("Error testing Shipday webhook:", error);
      toast.error("Failed to test Shipday webhook");
      throw new Error(error.message);
    }

    console.log("Webhook test response:", data);
    toast.success("Shipday webhook test completed successfully");
    return data;
  } catch (err) {
    console.error("Error in testShipdayWebhook:", err);
    toast.error("An unexpected error occurred while testing the webhook");
    throw err;
  }
};
