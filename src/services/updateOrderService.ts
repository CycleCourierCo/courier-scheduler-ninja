
import { supabase } from "@/integrations/supabase/client";
import { Order, OrderStatus } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";
import { updateJobStatuses } from "./jobService";

export const updateOrderStatus = async (
  id: string,
  status: OrderStatus
): Promise<Order> => {
  // No need to convert to string as OrderStatus is already compatible
  
  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating order status:", error);
    throw new Error(error.message);
  }

  // Update job statuses based on the new order status
  try {
    await updateJobStatuses(id, status);
  } catch (jobError) {
    console.error("Error updating job statuses:", jobError);
    // Continue with order update even if job update fails
  }

  return mapDbOrderToOrderType(data);
};

export const updateOrderScheduledDates = async (
  id: string,
  scheduledPickupDate: Date,
  scheduledDeliveryDate: Date
): Promise<Order> => {
  const { data, error } = await supabase
    .from("orders")
    .update({
      scheduled_pickup_date: scheduledPickupDate.toISOString(),
      scheduled_delivery_date: scheduledDeliveryDate.toISOString(),
      status: "scheduled" as OrderStatus,
      scheduled_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating order scheduled dates:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};

// Alias for updateOrderScheduledDates to maintain compatibility with existing code
export const updateOrderSchedule = updateOrderScheduledDates;

export const updatePublicOrder = async (
  id: string,
  pickup_date: string[],
  status: OrderStatus
): Promise<Order> => {
  // No need to convert status to string
  
  const { data, error } = await supabase
    .from("orders")
    .update({
      pickup_date,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating public order:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};

// New function to update order status manually by admin
export const updateAdminOrderStatus = async (
  id: string,
  status: OrderStatus
): Promise<Order> => {
  // No need to convert status to string
  
  const { data, error } = await supabase
    .from("orders")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating order status by admin:", error);
    throw new Error(error.message);
  }

  // Update job statuses based on the new order status
  try {
    await updateJobStatuses(id, status);
  } catch (jobError) {
    console.error("Error updating job statuses:", jobError);
    // Continue with order update even if job update fails
  }

  return mapDbOrderToOrderType(data);
};
