
import { supabase } from "@/integrations/supabase/client";
import { Order } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";

const attachInspectionSummary = async (order: Order, orderIdentifier: string): Promise<Order> => {
  if (!order.needsInspection) {
    return order;
  }

  try {
    const { data: summary } = await supabase.rpc(
      "get_public_inspection_summary" as any,
      { order_identifier: orderIdentifier }
    );

    if (summary) {
      order.inspectionSummary = summary;
    }
  } catch (e) {
    console.warn("Failed to fetch inspection summary:", e);
  }

  return order;
};

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

  const order = mapDbOrderToOrderType(data);
  return attachInspectionSummary(order, id);
};

// Alias for getOrder to maintain compatibility with existing code
export const getOrderById = getOrder;

export const getPublicOrder = async (id: string): Promise<Order | null> => {
  try {
    if (!id) {
      return null;
    }

    // Use the SECURITY DEFINER RPC which returns a sanitised order (no PII).
    const { data, error } = await supabase.rpc("get_public_order" as any, { p_identifier: id });

    if (error || !data) {
      return null;
    }

    const order = mapDbOrderToOrderType(data);

    // The RPC already attaches `inspection_summary` when needed; mirror it onto the order.
    const summary = (data as any).inspection_summary;
    if (summary) {
      (order as any).inspectionSummary = summary;
    }

    return order;
  } catch (err) {
    return null;
  }
};

