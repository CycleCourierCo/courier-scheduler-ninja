
import { supabase } from "@/integrations/supabase/client";
import { Order } from "@/types/order";
import { mapDbOrderToOrderType } from "./utils/orderMappers";

/**
 * Retrieves all orders
 */
export const getOrders = async (): Promise<Order[]> => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error getting orders:", error);
    throw new Error(error.message);
  }

  return data.map(mapDbOrderToOrderType);
};

/**
 * Retrieves a specific order by ID
 */
export const getOrder = async (id: string): Promise<Order> => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error getting order:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};

/**
 * Alias for getOrder to maintain compatibility with existing code
 */
export const getOrderById = getOrder;

/**
 * Gets an order for public (non-authenticated) access
 */
export const getPublicOrder = async (id: string): Promise<Order> => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error getting public order:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};
