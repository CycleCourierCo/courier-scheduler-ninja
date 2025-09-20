import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Order } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";
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

export const updateSenderAvailability = async (orderId: string, dates: Date[], notes: string): Promise<Order | null> => {
  try {
    if (!orderId || !dates || dates.length === 0) {
      console.error("Invalid parameters for updateSenderAvailability");
      return null;
    }
    
    console.log(`Updating sender availability for order ${orderId}`);
    console.log(`Selected dates: ${dates.map(d => d.toISOString())}`);
    
    // Format dates as ISO strings
    const dateStrings = dates.map(date => date.toISOString());
    
    // Update the order with all sender availability data in one transaction
    const { data, error } = await supabase
      .from("orders")
      .update({
        pickup_date: dateStrings,
        sender_notes: notes.trim(),
        sender_confirmed_at: new Date().toISOString(),
        status: "receiver_availability_pending",
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId)
      .select()
      .single();
    
    if (error) {
      console.error("Error updating sender availability:", error);
      return null;
    }
    
    console.log("Sender availability confirmed. Proceeding to notify receiver.");
    
    // Map the database response to our Order type
    const order = mapDbOrderToOrderType(data);
    
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
    
    return order;
  } catch (error) {
    console.error("Unexpected error in updateSenderAvailability:", error);
    return null;
  }
};

export const updateReceiverAvailability = async (orderId: string, dates: Date[], notes: string): Promise<Order | null> => {
  try {
    if (!orderId || !dates || dates.length === 0) {
      console.error("Invalid parameters for updateReceiverAvailability");
      return null;
    }
    
    console.log(`Updating receiver availability for order ${orderId}`);
    console.log(`Selected dates: ${dates.map(d => d.toISOString())}`);
    console.log(`Notes: ${notes}`);
    console.log(`Auth UID: ${JSON.stringify((await supabase.auth.getUser()).data.user?.id)}`);
    
    // Format dates as ISO strings
    const dateStrings = dates.map(date => date.toISOString());
    
    // Update the order with all receiver availability data in one transaction
    const { data, error } = await supabase
      .from("orders")
      .update({
        delivery_date: dateStrings,
        receiver_notes: notes.trim(),
        receiver_confirmed_at: new Date().toISOString(),
        status: "scheduled_dates_pending",
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId)
      .select()
      .single();
    
    if (error) {
      console.error("Error updating receiver availability:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return null;
    }
    
    console.log("Receiver availability confirmed successfully");
    
    // Map the database response to our Order type
    const order = mapDbOrderToOrderType(data);
    
    return order;
  } catch (error) {
    console.error("Unexpected error in updateReceiverAvailability:", error);
    return null;
  }
};

export const getSenderAvailability = async (orderId: string) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("sender_notes, pickup_date")
      .eq("id", orderId)
      .single();

    if (error) {
      console.error("Error fetching sender availability:", error);
      toast.error("Failed to fetch sender availability.");
      return null;
    }

    // Safely convert the JSON array to Date objects with type checking
    const dates: Date[] = [];
    if (Array.isArray(data.pickup_date)) {
      for (const dateItem of data.pickup_date) {
        if (typeof dateItem === 'string') {
          try {
            dates.push(new Date(dateItem));
          } catch (e) {
            console.error("Invalid date format in pickup_date:", dateItem);
          }
        }
      }
    }

    return {
      notes: data.sender_notes || "",
      dates: dates
    };
  } catch (error) {
    console.error("Unexpected error fetching sender availability:", error);
    toast.error("Unexpected error fetching sender availability.");
    return null;
  }
};

export const getReceiverAvailability = async (orderId: string) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("receiver_notes, delivery_date")
      .eq("id", orderId)
      .single();

    if (error) {
      console.error("Error fetching receiver availability:", error);
      toast.error("Failed to fetch receiver availability.");
      return null;
    }

    // Safely convert the JSON array to Date objects with type checking
    const dates: Date[] = [];
    if (Array.isArray(data.delivery_date)) {
      for (const dateItem of data.delivery_date) {
        if (typeof dateItem === 'string') {
          try {
            dates.push(new Date(dateItem));
          } catch (e) {
            console.error("Invalid date format in delivery_date:", dateItem);
          }
        }
      }
    }

    return {
      notes: data.receiver_notes || "",
      dates: dates
    };
  } catch (error) {
    console.error("Unexpected error fetching receiver availability:", error);
    toast.error("Unexpected error fetching receiver availability.");
    return null;
  }
};
