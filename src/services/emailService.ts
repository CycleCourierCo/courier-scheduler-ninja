
import { supabase } from "@/integrations/supabase/client";
import { getOrder } from "./getOrderService";

/**
 * Resends the availability confirmation email to the sender
 */
export const resendSenderAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    const order = await getOrder(id);
    
    if (!order || !order.sender || !order.sender.email) {
      console.error("Order or sender information not found");
      return false;
    }
    
    const baseUrl = window.location.origin;
    
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: order.sender.email,
        name: order.sender.name || "Sender",
        orderId: id,
        baseUrl,
        emailType: "sender" 
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

/**
 * Sends or resends the availability confirmation email to the receiver
 */
export const sendReceiverAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    const order = await getOrder(id);
    
    if (!order || !order.receiver || !order.receiver.email) {
      console.error("Order or receiver information not found");
      return false;
    }
    
    const baseUrl = window.location.origin;
    
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: order.receiver.email,
        name: order.receiver.name || "Recipient",
        orderId: id,
        baseUrl,
        emailType: "receiver" 
      }
    });
    
    if (response.error) {
      console.error("Error sending email to receiver:", response.error);
      return false;
    }
    
    console.log("Email sent successfully to receiver:", order.receiver.email);
    return true;
  } catch (error) {
    console.error("Failed to send email to receiver:", error);
    return false;
  }
};
