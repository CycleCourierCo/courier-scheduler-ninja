import { supabase } from "@/integrations/supabase/client";
import { Order, OrderStatus } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";
import { createJobsForOrder } from "./jobService";

export const getSenderAvailabilityLink = async (id: string): Promise<string> => {
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error getting sender availability link:", error);
    throw new Error(error.message);
  }

  return `${window.location.origin}/sender-availability/${id}`;
};

export const getReceiverAvailabilityLink = async (id: string): Promise<string> => {
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error getting receiver availability link:", error);
    throw new Error(error.message);
  }

  return `${window.location.origin}/receiver-availability/${id}`;
};

export const confirmSenderAvailability = async (
  id: string,
  pickupDate: Date[]
): Promise<Order> => {
  const { data, error } = await supabase
    .from("orders")
    .update({
      pickup_date: pickupDate.map(date => date.toISOString()),
      status: "sender_availability_confirmed",
      sender_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error confirming sender availability:", error);
    throw new Error(error.message);
  }

  const mappedOrder = mapDbOrderToOrderType(data);
  
  // Attempt to create jobs, but don't throw if it fails
  // We'll create them on receiver confirmation if they don't exist yet
  try {
    await createJobsForOrder(mappedOrder);
  } catch (jobError) {
    console.error("Error creating jobs on sender confirmation:", jobError);
  }

  return mappedOrder;
};

export const confirmReceiverAvailability = async (
  id: string,
  deliveryDate: Date[]
): Promise<Order> => {
  const { data, error } = await supabase
    .from("orders")
    .update({
      delivery_date: deliveryDate.map(date => date.toISOString()),
      status: "receiver_availability_confirmed",
      receiver_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error confirming receiver availability:", error);
    throw new Error(error.message);
  }

  const mappedOrder = mapDbOrderToOrderType(data);
  
  // Now that receiver has confirmed, definitely create jobs
  try {
    await createJobsForOrder(mappedOrder);
  } catch (jobError) {
    console.error("Error creating jobs on receiver confirmation:", jobError);
  }

  return mappedOrder;
};

export const updateOrderAvailability = async (
  id: string,
  pickupDate: Date[],
  deliveryDate: Date[]
): Promise<Order> => {
  const { data, error } = await supabase
    .from("orders")
    .update({
      pickup_date: pickupDate.map(date => date.toISOString()),
      delivery_date: deliveryDate.map(date => date.toISOString()),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating order availability:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};
