
import { supabase } from "@/integrations/supabase/client";
import { Order, OrderStatus } from "@/types/order";
import { mapDbOrderToOrderType } from "./utils/orderMappers";

/**
 * Updates the status of an order
 */
export const updateOrderStatus = async (
  id: string,
  status: OrderStatus
): Promise<Order> => {
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

  return mapDbOrderToOrderType(data);
};

/**
 * Updates the scheduled pickup and delivery dates for an order
 */
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
      status: "scheduled",
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

/**
 * Alias for updateOrderScheduledDates to maintain compatibility
 */
export const updateOrderSchedule = updateOrderScheduledDates;

/**
 * Updates a public order (for non-authenticated access)
 */
export const updatePublicOrder = async (
  id: string,
  pickup_date: string[],
  status: OrderStatus
): Promise<Order> => {
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
