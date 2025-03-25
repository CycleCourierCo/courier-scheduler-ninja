
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
      console.error("Invalid order ID provided:", id);
      console.error("Current domain:", window.location.origin);
      return null;
    }

    console.log(`Fetching public order with ID: ${id} from domain: ${window.location.origin}`);
    
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error getting public order:", error);
      console.error("Error details:", JSON.stringify(error));
      console.error("Domain information:", window.location.origin);
      console.error("Full URL:", window.location.href);
      
      // Return null instead of throwing when the order is not found or another error occurs
      // This allows the UI to handle the error more gracefully
      return null;
    }

    if (!data) {
      console.error("No order found with ID:", id);
      console.error("Current domain:", window.location.origin);
      return null;
    }

    console.log("Order data retrieved successfully:", data.id);
    return mapDbOrderToOrderType(data);
  } catch (err) {
    console.error("Unexpected error in getPublicOrder:", err);
    console.error("Error object:", JSON.stringify(err, null, 2));
    console.error("Domain information:", window.location.origin);
    return null;
  }
};
