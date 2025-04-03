import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { resendReceiverAvailabilityEmail } from "./emailService";

export const confirmSenderAvailability = async (orderId: string, dateStrings: string[]): Promise<boolean> => {
  try {
    console.log("Confirming sender availability for order:", orderId);
    console.log("Selected dates:", dateStrings);
    
    if (!dateStrings || dateStrings.length === 0) {
      console.error("No dates selected for confirmation");
      return false;
    }
    
    // Update the order with the new pickup_date and status
    const { data, error } = await supabase
      .from("orders")
      .update({
        pickup_date: dateStrings,
        status: "sender_availability_confirmed",
        sender_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId)
      .select()
      .single();
    
    if (error) {
      console.error("Error confirming sender availability:", error);
      return false;
    }
    
    console.log("Sender availability confirmed. Proceeding to update status and notify receiver.");
    
    // Automatically update status to receiver_availability_pending
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "receiver_availability_pending",
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);
    
    if (updateError) {
      console.error("Error updating to receiver_availability_pending:", updateError);
      // Continue anyway to try sending the email
    }
    
    // Send receiver availability email
    try {
      const emailSent = await resendReceiverAvailabilityEmail(orderId);
      console.log("Receiver availability email sent:", emailSent);
      
      if (!emailSent) {
        console.error("Failed to send receiver availability email");
      }
    } catch (emailError) {
      console.error("Error sending receiver availability email:", emailError);
    }
    
    return true;
  } catch (error) {
    console.error("Unexpected error in confirmSenderAvailability:", error);
    return false;
  }
};

export const confirmReceiverAvailability = async (orderId: string, dateStrings: string[]): Promise<boolean> => {
  try {
    console.log("Confirming receiver availability for order:", orderId);
    console.log("Selected dates:", dateStrings);
    
    if (!dateStrings || dateStrings.length === 0) {
      console.error("No dates selected for confirmation");
      return false;
    }
    
    const { data, error } = await supabase
      .from("orders")
      .update({
        delivery_date: dateStrings,
        status: "receiver_availability_confirmed",
        receiver_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId)
      .select()
      .single();
    
    if (error) {
      console.error("Error confirming receiver availability:", error);
      return false;
    }
    
    console.log("Receiver availability confirmed successfully");
    
    // Automatically update status to scheduled_dates_pending
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "scheduled_dates_pending",
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);
    
    if (updateError) {
      console.error("Error updating to scheduled_dates_pending:", updateError);
    }
    
    return true;
  } catch (error) {
    console.error("Unexpected error in confirmReceiverAvailability:", error);
    return false;
  }
};

export const getSenderAvailability = async (orderId: string) => {
  try {
    const { data, error } = await supabase
      .from("availability")
      .select("*")
      .eq("order_id", orderId)
      .eq("type", "sender")
      .single();

    if (error) {
      console.error("Error fetching sender availability:", error);
      toast.error("Failed to fetch sender availability.");
      return null;
    }

    return data;
  } catch (error) {
    console.error("Unexpected error fetching sender availability:", error);
    toast.error("Unexpected error fetching sender availability.");
    return null;
  }
};

export const getReceiverAvailability = async (orderId: string) => {
  try {
    const { data, error } = await supabase
      .from("availability")
      .select("*")
      .eq("order_id", orderId)
      .eq("type", "receiver")
      .single();

    if (error) {
      console.error("Error fetching receiver availability:", error);
      toast.error("Failed to fetch receiver availability.");
      return null;
    }

    return data;
  } catch (error) {
    console.error("Unexpected error fetching receiver availability:", error);
    toast.error("Unexpected error fetching receiver availability.");
    return null;
  }
};
