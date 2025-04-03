
import { Order } from "@/types/order";
import { supabase } from "@/integrations/supabase/client";
import { mapDbOrderToOrderType } from "./orderServiceUtils";

/**
 * Fetches an order by tracking number
 * @param trackingNumber The tracking number of the order
 * @returns The order object
 */
export const getOrderByTrackingNumber = async (trackingNumber: string): Promise<Order> => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("tracking_number", trackingNumber)
    .single();

  if (error) {
    console.error("Error getting order by tracking number:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};

/**
 * Polls for order updates
 * @param id The ID of the order to poll
 * @param interval The polling interval in ms (default: 10000)
 * @returns A cleanup function to stop polling
 */
export const pollOrderUpdates = (id: string, onUpdate: (order: Order) => void, interval = 10000) => {
  // Initial fetch
  const fetchOrder = async () => {
    try {
      const order = await mapDbOrderToOrderType(
        (await supabase
          .from("orders")
          .select("*")
          .eq("id", id)
          .single()
        ).data
      );
      
      if (order) {
        onUpdate(order);
      }
    } catch (error) {
      console.error("Error polling order:", error);
    }
  };

  // Set up polling
  fetchOrder(); // First immediate call
  const intervalId = setInterval(fetchOrder, interval);
  
  // Return cleanup function
  return () => clearInterval(intervalId);
};

