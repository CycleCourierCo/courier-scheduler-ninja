
import { supabase } from "@/integrations/supabase/client";
import { Order, OrderStatus } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";

// Update the schema type based on Supabase database schema
type UpdateSenderAvailabilityPayload = {
  pickup_date: string[];
  status: OrderStatus;
  sender_confirmed_at: string;
  sender_notes?: string;
};

type UpdateReceiverAvailabilityPayload = {
  delivery_date: string[];
  status: OrderStatus;
  receiver_confirmed_at: string;
  receiver_notes?: string;
};

export const updateSenderAvailability = async (
  id: string,
  dates: Date[],
  notes: string
): Promise<Order | null> => {
  try {
    if (!id || typeof id !== 'string') {
      console.error("Invalid order ID:", id);
      return null;
    }
    
    console.log("Updating sender availability for order ID:", id);
    console.log("Selected dates:", dates);
    
    // First check if the order exists
    const { data: orderExists, error: checkError } = await supabase
      .from("orders")
      .select("id")
      .eq("id", id)
      .single();
    
    if (checkError || !orderExists) {
      console.error("Error checking order existence:", checkError);
      return null;
    }

    const payload: UpdateSenderAvailabilityPayload = {
      pickup_date: dates.map(date => date.toISOString()),
      status: "sender_availability_confirmed",
      sender_confirmed_at: new Date().toISOString(),
    };

    // Only include notes if there are any
    if (notes && notes.trim() !== "") {
      payload.sender_notes = notes.trim();
    }
    
    console.log("Sending payload to Supabase:", JSON.stringify(payload));
    
    const { data, error } = await supabase
      .from("orders")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating sender availability:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return null;
    }

    // Update receiver_availability_pending status only if successful
    await updateOrderStatusAfterSenderConfirmation(id);
    
    console.log("Sender availability updated successfully:", data.id);
    return mapDbOrderToOrderType(data);
  } catch (err) {
    console.error("Error in updateSenderAvailability:", err);
    console.error("Error details:", JSON.stringify(err, null, 2));
    console.error("Parameters - ID:", id, "Dates count:", dates?.length);
    return null;
  }
};

export const updateReceiverAvailability = async (
  id: string,
  dates: Date[],
  notes: string
): Promise<Order | null> => {
  try {
    if (!id || typeof id !== 'string') {
      console.error("Invalid order ID:", id);
      return null;
    }
    
    console.log("Updating receiver availability for order ID:", id);
    console.log("Selected dates:", dates);
    
    // First check if the order exists
    const { data: orderExists, error: checkError } = await supabase
      .from("orders")
      .select("id")
      .eq("id", id)
      .single();
    
    if (checkError || !orderExists) {
      console.error("Error checking order existence:", checkError);
      return null;
    }

    const payload: UpdateReceiverAvailabilityPayload = {
      delivery_date: dates.map(date => date.toISOString()),
      status: "receiver_availability_confirmed",
      receiver_confirmed_at: new Date().toISOString(),
    };

    // Only include notes if there are any
    if (notes && notes.trim() !== "") {
      payload.receiver_notes = notes.trim();
    }
    
    console.log("Sending payload to Supabase:", JSON.stringify(payload));
    
    const { data, error } = await supabase
      .from("orders")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating receiver availability:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return null;
    }

    // Update pending_approval status only if successful
    await updateOrderStatusAfterReceiverConfirmation(id);
    
    console.log("Receiver availability updated successfully:", data.id);
    return mapDbOrderToOrderType(data);
  } catch (err) {
    console.error("Error in updateReceiverAvailability:", err);
    console.error("Error details:", JSON.stringify(err, null, 2));
    console.error("Parameters - ID:", id, "Dates count:", dates?.length);
    return null;
  }
};

const updateOrderStatusAfterSenderConfirmation = async (
  id: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from("orders")
      .update({
        status: "receiver_availability_pending"
      })
      .eq("id", id)
      .eq("status", "sender_availability_confirmed");

    if (error) {
      console.error("Error updating to receiver_availability_pending:", error);
    }
  } catch (err) {
    console.error("Error in updateOrderStatusAfterSenderConfirmation:", err);
  }
};

const updateOrderStatusAfterReceiverConfirmation = async (
  id: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from("orders")
      .update({
        status: "pending_approval"
      })
      .eq("id", id)
      .eq("status", "receiver_availability_confirmed");

    if (error) {
      console.error("Error updating to pending_approval:", error);
    }
  } catch (err) {
    console.error("Error in updateOrderStatusAfterReceiverConfirmation:", err);
  }
};
