
import { supabase } from "@/integrations/supabase/client";
import { getOrder } from "./fetchOrderService";

export const resendSenderAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    console.log("Starting to resend sender availability email for order ID:", id);
    
    // Get the order details first
    const order = await getOrder(id);
    
    // Ensure the order exists and has a sender
    if (!order || !order.sender || !order.sender.email) {
      console.error("Order or sender information not found for ID:", id);
      return false;
    }
    
    // Use the current domain dynamically
    const baseUrl = window.location.origin;
    console.log("Using base URL for email:", baseUrl);
    
    // Create item from bike details
    const item = {
      name: `${order.bikeBrand} ${order.bikeModel}`.trim(),
      quantity: 1,
      price: 0
    };
    
    console.log("Sending sender email to:", order.sender.email);
    
    // Send email to sender with improved error handling
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: order.sender.email,
        name: order.sender.name || "Sender",
        orderId: id,
        baseUrl,
        emailType: "sender",
        item: item
      }
    });
    
    if (response.error) {
      console.error("Error resending email to sender:", response.error);
      return false;
    }
    
    console.log("Email resent successfully to sender:", order.sender.email);
    return true;
  } catch (error) {
    console.error("Failed to resend email:", error);
    return false;
  }
};

export const resendReceiverAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    console.log("Starting to send receiver availability email for order ID:", id);
    
    // Get the order details first
    const order = await getOrder(id);
    
    // Ensure the order exists and has a receiver
    if (!order || !order.receiver || !order.receiver.email) {
      console.error("Order or receiver information not found for ID:", id);
      return false;
    }
    
    // Use the current domain dynamically
    const baseUrl = window.location.origin;
    console.log("Using base URL for email:", baseUrl);
    
    // Create item from bike details
    const item = {
      name: `${order.bikeBrand} ${order.bikeModel}`.trim(),
      quantity: 1,
      price: 0
    };
    
    console.log("Sending receiver email to:", order.receiver.email);
    
    // Send email to receiver with improved error handling
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: order.receiver.email,
        name: order.receiver.name || "Receiver",
        orderId: id,
        baseUrl,
        emailType: "receiver",
        item: item
      }
    });
    
    if (response.error) {
      console.error("Error sending email to receiver:", response.error);
      console.error("Response error details:", JSON.stringify(response.error, null, 2));
      return false;
    }
    
    console.log("Email sent successfully to receiver:", order.receiver.email, "Response:", JSON.stringify(response.data));
    return true;
  } catch (error) {
    console.error("Failed to send email to receiver:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return false;
  }
};
