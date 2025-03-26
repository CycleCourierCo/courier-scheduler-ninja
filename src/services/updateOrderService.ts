
import { supabase } from "@/integrations/supabase/client";
import { Order, OrderStatus } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";

export const updateOrderStatus = async (
  id: string,
  status: OrderStatus
): Promise<Order> => {
  // No need to convert to string as OrderStatus is already compatible
  const dbStatus = status;
  
  const { data, error } = await supabase
    .from("orders")
    .update({ status: dbStatus })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating order status:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};

export const updateOrderScheduledDates = async (
  id: string,
  scheduledPickupDate: Date,
  scheduledDeliveryDate: Date,
  changeStatus: boolean = true
): Promise<Order> => {
  const updateData: any = {
    scheduled_pickup_date: scheduledPickupDate.toISOString(),
    scheduled_delivery_date: scheduledDeliveryDate.toISOString(),
    scheduled_at: new Date().toISOString()
  };
  
  // Only update status to "scheduled" if explicitly requested
  if (changeStatus) {
    updateData.status = "scheduled" as OrderStatus;
  }

  const { data, error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating order scheduled dates:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};

// Modified to not automatically change status to scheduled
export const updateOrderSchedule = async (
  id: string,
  scheduledPickupDate: Date,
  scheduledDeliveryDate: Date
): Promise<Order> => {
  return updateOrderScheduledDates(id, scheduledPickupDate, scheduledDeliveryDate, false);
};

export const updatePublicOrder = async (
  id: string,
  pickup_date: string[],
  status: OrderStatus
): Promise<Order> => {
  // No need to convert status to string
  const dbStatus = status;
  
  const { data, error } = await supabase
    .from("orders")
    .update({
      pickup_date,
      status: dbStatus,
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
  const dbStatus = status;
  
  const { data, error } = await supabase
    .from("orders")
    .update({
      status: dbStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating order status by admin:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};
