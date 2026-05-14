
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

    let order: Order | null = null;

    // First try to fetch by UUID (id column)
    if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      const { data, error } = await supabase
        .from("orders")
        .select("*, tracking_events")
        .eq("id", id)
        .single();

      if (!error && data) {
        order = mapDbOrderToOrderType(data);
      }
    }

    // Try to fetch by tracking_number
    if (!order) {
      const { data: orderByTracking, error: trackingError } = await supabase
        .from("orders")
        .select("*, tracking_events")
        .eq("tracking_number", id)
        .single();

      if (!trackingError && orderByTracking) {
        order = mapDbOrderToOrderType(orderByTracking);
      }
    }

    // If still nothing, try customer_order_number
    if (!order) {
      const { data: orderByCustomId, error: customIdError } = await supabase
        .from("orders")
        .select("*, tracking_events")
        .eq("customer_order_number", id)
        .single();

      if (!customIdError && orderByCustomId) {
        order = mapDbOrderToOrderType(orderByCustomId);
      }
    }

    if (!order) {
      return null;
    }

    // Attach inspection summary for orders that need inspection
    if (order.needsInspection) {
      try {
        const { data: summary } = await supabase.rpc(
          "get_public_inspection_summary" as any,
          { order_identifier: id }
        );
        if (summary) {
          (order as any).inspectionSummary = summary;
        }
      } catch (e) {
        console.warn("Failed to fetch inspection summary:", e);
      }
    }

    return order;
  } catch (err) {
    return null;
  }
};
