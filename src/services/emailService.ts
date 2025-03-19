
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
