
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

    console.log(`Fetching public order with ID or tracking number: ${id} from domain: ${window.location.origin}`);
    
    // First try to fetch by UUID (id column)
    if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      console.log("ID looks like a UUID, trying to fetch by id column");
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();
  
      if (!error && data) {
        console.log("Order data retrieved successfully by UUID:", data.id);
        return mapDbOrderToOrderType(data);
      }
    }
    
    // Try to fetch by tracking_number (which should have the CCC754... format)
    console.log("Trying to fetch by tracking_number:", id);
    const { data: orderByTracking, error: trackingError } = await supabase
      .from("orders")
      .select("*")
      .eq("tracking_number", id)
      .single();
    
    if (!trackingError && orderByTracking) {
      console.log("Order data retrieved successfully by tracking number:", orderByTracking.id);
      return mapDbOrderToOrderType(orderByTracking);
    }
    
    // If tracking_number search failed, try to fetch by customer_order_number
    console.log("Trying to fetch by customer_order_number:", id);
    const { data: orderByCustomId, error: customIdError } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_order_number", id)
      .single();
    
    if (customIdError) {
      console.error("Error getting public order by customer_order_number:", customIdError);
      console.error("Error details:", JSON.stringify(customIdError));
      console.error("Domain information:", window.location.origin);
      console.error("Full URL:", window.location.href);
      
      return null;
    }

    if (!orderByCustomId) {
      console.error("No order found with ID:", id);
      console.error("Current domain:", window.location.origin);
      return null;
    }

    console.log("Order data retrieved successfully by custom ID:", orderByCustomId.id);
    return mapDbOrderToOrderType(orderByCustomId);
  } catch (err) {
    console.error("Unexpected error in getPublicOrder:", err);
    console.error("Error object:", JSON.stringify(err, null, 2));
    console.error("Domain information:", window.location.origin);
    return null;
  }
};
