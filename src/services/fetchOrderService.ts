
import { supabase } from "@/integrations/supabase/client";
import { Order } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";

export const getOrders = async (): Promise<Order[]> => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
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
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};

// Alias for getOrder to maintain compatibility with existing code
export const getOrderById = getOrder;

export const getPublicOrder = async (id: string): Promise<Order | null> => {
  try {
    if (!id) {
      return null;
    }
    
    // First try to fetch by UUID (id column)
    if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      const { data, error } = await supabase
        .from("orders")
        .select("*, tracking_events")
        .eq("id", id)
        .single();
  
      if (!error && data) {
        return mapDbOrderToOrderType(data);
      }
    }
    
    // Try to fetch by tracking_number (which should have the CCC754... format)
    const { data: orderByTracking, error: trackingError } = await supabase
      .from("orders")
      .select("*, tracking_events")
      .eq("tracking_number", id)
      .single();
    
    if (!trackingError && orderByTracking) {
      return mapDbOrderToOrderType(orderByTracking);
    }
    
    // If tracking_number search failed, try to fetch by customer_order_number
    const { data: orderByCustomId, error: customIdError } = await supabase
      .from("orders")
      .select("*, tracking_events")
      .eq("customer_order_number", id)
      .single();
    
    if (customIdError) {
      return null;
    }

    if (!orderByCustomId) {
      return null;
    }

    return mapDbOrderToOrderType(orderByCustomId);
  } catch (err) {
    return null;
  }
};
