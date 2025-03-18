import { supabase } from "@/integrations/supabase/client";
import { Order, CreateOrderFormData } from "@/types/order";

export const createOrder = async (data: CreateOrderFormData): Promise<Order> => {
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      sender: data.sender,
      receiver: data.receiver,
      bike_brand: data.bikeBrand,
      bike_model: data.bikeModel,
      customer_order_number: data.customerOrderNumber,
      needs_payment_on_collection: data.needsPaymentOnCollection,
      is_bike_swap: data.isBikeSwap,
      delivery_instructions: data.deliveryInstructions,
      status: "created", // Use the enum literal value
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating order:", error);
    throw new Error(error.message);
  }

  return order as Order;
};

export const getOrders = async (): Promise<Order[]> => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error getting orders:", error);
    throw new Error(error.message);
  }

  return data as Order[];
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

  return data as Order;
};

export const updateOrderStatus = async (
  id: string,
  status: "sender_availability_confirmed" | "receiver_availability_confirmed" | "scheduled" | "delivered" | "cancelled"
): Promise<Order> => {
  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating order status:", error);
    throw new Error(error.message);
  }

  return data as Order;
};

export const updateOrderScheduledDates = async (
  id: string,
  scheduledPickupDate: Date,
  scheduledDeliveryDate: Date
): Promise<Order> => {
  const { data, error } = await supabase
    .from("orders")
    .update({
      scheduled_pickup_date: scheduledPickupDate.toISOString(),
      scheduled_delivery_date: scheduledDeliveryDate.toISOString(),
      status: "scheduled"
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating order scheduled dates:", error);
    throw new Error(error.message);
  }

  return data as Order;
};

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

  return data as Order;
};

export const updatePublicOrder = async (
  id: string,
  pickup_date: string[],
  status: "sender_availability_confirmed" | "receiver_availability_confirmed"
): Promise<Order> => {
  const { data, error } = await supabase
    .from("orders")
    .update({
      pickup_date,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating public order:", error);
    throw new Error(error.message);
  }

  return data as Order;
};

export const resendSenderAvailabilityEmail = async (id: string): Promise<boolean> => {
  // Implementation for resend email function
  
  // Return true to indicate success
  return true;
};
