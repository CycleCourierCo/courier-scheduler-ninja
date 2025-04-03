// Re-export all order services to maintain API compatibility
export * from './orderServiceUtils';
export * from './createOrderService';
export * from './fetchOrderService';
export * from './updateOrderService';
export * from './availabilityService';
export * from './emailService';
export * from './routingService';
export * from './jobService';

export const getOrderById = async (id: string): Promise<Order | null> => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching order:", error);
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }
    
    console.log("Raw order data from DB:", data);

    return mapDbOrderToOrderType(data);
  } catch (err) {
    console.error("Error in getOrderById:", err);
    throw err;
  }
};
