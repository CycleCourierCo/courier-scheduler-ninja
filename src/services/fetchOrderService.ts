
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

    const { data, error } = await supabase.rpc("get_public_order" as any, { p_identifier: id });

    if (error || !data) {
      return null;
    }

    const order = mapDbOrderToOrderType(data);
    const summary = (data as any).inspection_summary;
    if (summary) {
      (order as any).inspectionSummary = summary;
    }
    return order;
  } catch (err) {
    return null;
  }
};

/**
 * Public tracking endpoint that unlocks POD photos / signatures for the side
 * (sender = collection, receiver = delivery) whose postcode matches.
 *
 * Returns `{ order, verified, rateLimited, revealedSide }`. When `verified` is
 * false the order payload still reflects the default sanitised view (no POD URLs).
 */
export const verifyPublicOrderPostcode = async (
  identifier: string,
  postcode: string,
): Promise<{
  order: Order | null;
  verified: boolean;
  rateLimited: boolean;
  revealedSide: 'sender' | 'receiver' | null;
}> => {
  if (!identifier || !postcode) {
    return { order: null, verified: false, rateLimited: false, revealedSide: null };
  }

  const { data, error } = await supabase.rpc("get_public_order_with_proof" as any, {
    p_identifier: identifier,
    p_postcode: postcode,
  });

  if (error || !data) {
    return { order: null, verified: false, rateLimited: false, revealedSide: null };
  }

  const payload = data as any;
  const order = mapDbOrderToOrderType(payload);
  const summary = payload.inspection_summary;
  if (summary) {
    (order as any).inspectionSummary = summary;
  }

  return {
    order,
    verified: !payload.verification_failed,
    rateLimited: !!payload.rate_limited,
    revealedSide: (payload.revealed_side ?? null) as 'sender' | 'receiver' | null,
  };
};

