import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Test utility to simulate a Shipday webhook event
 * This can be used to trigger the webhook with simulated data to verify it's working
 * 
 * @param orderId The ID of the order to test with
 * @param eventType The type of Shipday event to simulate
 * @returns The response from the webhook
 */
export const testShipdayWebhook = async (
  orderId: string,
  eventType: "ORDER_ASSIGNED" | "ORDER_ACCEPTED_AND_STARTED" | "ORDER_PIKEDUP" | "ORDER_COMPLETED" | "ORDER_FAILED"
) => {
  try {
    // Extract just the first part of the orderId for the test (same as how Shipday references it)
    const shortOrderId = orderId.substring(0, 8);
    
    // Create a mock Shipday webhook payload
    const mockPayload = {
      timestamp: Date.now(),
      event: eventType,
      order_status: eventType === "ORDER_COMPLETED" ? "ALREADY_DELIVERED" : 
                    eventType === "ORDER_PIKEDUP" ? "PICKED_UP" : "STARTED",
      order: {
        id: 123456,
        order_number: `${shortOrderId}-PICKUP`, // For testing pickup events
        // ... other order fields would be here in a real webhook
      },
      company: {
        id: 1,
        name: "Cycle Courier Co."
      },
      delivery_details: {
        name: "Test Receiver",
        phone: "+1234567890",
        address: "123 Test St"
      },
      pickup_details: {
        name: "Test Sender",
        phone: "+1234567890",
        address: "456 Test Ave"
      },
      carrier: {
        id: 7890,
        name: "Test Driver",
        phone: "+9876543210"
      }
    };
    
    // Call the webhook function directly with our test payload
    const { data, error } = await supabase.functions.invoke("shipday-webhook", {
      body: mockPayload,
      // Include the webhook token if it's configured
      headers: {
        token: "test-token" // This should match your SHIPDAY_WEBHOOK_TOKEN in supabase secrets
      }
    });

    if (error) {
      console.error("Error testing Shipday webhook:", error);
      toast.error("Failed to test Shipday webhook");
      throw new Error(error.message);
    }

    toast.success("Webhook test completed");
    console.log("Webhook test response:", data);
    return data;
  } catch (err) {
    console.error("Error in testShipdayWebhook:", err);
    toast.error("An unexpected error occurred during webhook test");
    throw err;
  }
};
