
import { supabase } from "@/integrations/supabase/client";
import { Order } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";

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

// Alias for getOrder to maintain compatibility with existing code
export const getOrderById = getOrder;

export const getPublicOrder = async (id: string): Promise<Order | null> => {
  try {
    if (!id) {
      console.error("Invalid order ID provided");
      return null;
    }

    console.log(`Fetching public order with ID: ${id}`);
    
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no match is found
    
    if (error) {
      console.error("Error getting public order:", error);
      return null;
    }

    if (!data) {
      console.error("No order found with ID:", id);
      return null;
    }

    console.log("Order data retrieved successfully:", data.id);
    return mapDbOrderToOrderType(data);
  } catch (err) {
    console.error("Unexpected error in getPublicOrder:", err);
    return null;
  }
};
