
import { supabase } from "@/integrations/supabase/client";
import { Order, CreateOrderFormData, OrderStatus } from "@/types/order";
import { useAuth } from "@/contexts/AuthContext";

// Helper function to map database schema to our Order type
const mapDbOrderToOrderType = (dbOrder: any): Order => {
  return {
    id: dbOrder.id,
    user_id: dbOrder.user_id, // Include user_id in the returned object
    sender: dbOrder.sender,
    receiver: dbOrder.receiver,
    pickupDate: dbOrder.pickup_date ? JSON.parse(JSON.stringify(dbOrder.pickup_date)) : undefined,
    deliveryDate: dbOrder.delivery_date ? JSON.parse(JSON.stringify(dbOrder.delivery_date)) : undefined,
    scheduledPickupDate: dbOrder.scheduled_pickup_date ? new Date(dbOrder.scheduled_pickup_date) : undefined,
    scheduledDeliveryDate: dbOrder.scheduled_delivery_date ? new Date(dbOrder.scheduled_delivery_date) : undefined,
    senderConfirmedAt: dbOrder.sender_confirmed_at ? new Date(dbOrder.sender_confirmed_at) : undefined,
    receiverConfirmedAt: dbOrder.receiver_confirmed_at ? new Date(dbOrder.receiver_confirmed_at) : undefined,
    scheduledAt: dbOrder.scheduled_at ? new Date(dbOrder.scheduled_at) : undefined,
    status: dbOrder.status,
    createdAt: new Date(dbOrder.created_at),
    updatedAt: new Date(dbOrder.updated_at),
    trackingNumber: dbOrder.tracking_number,
    bikeBrand: dbOrder.bike_brand,
    bikeModel: dbOrder.bike_model,
    customerOrderNumber: dbOrder.customer_order_number,
    needsPaymentOnCollection: dbOrder.needs_payment_on_collection,
    isBikeSwap: dbOrder.is_bike_swap,
    deliveryInstructions: dbOrder.delivery_instructions
  };
};

// Get current user ID (for operations that need it)
const getCurrentUserId = () => {
  const auth = supabase.auth.getSession();
  return auth || null;
};

export const createOrder = async (data: CreateOrderFormData): Promise<Order> => {
  // Get current user ID from Supabase auth session
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.user?.id) {
    throw new Error("User not authenticated");
  }

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: session.session.user.id,
      sender: data.sender,
      receiver: data.receiver,
      bike_brand: data.bikeBrand,
      bike_model: data.bikeModel,
      customer_order_number: data.customerOrderNumber,
      needs_payment_on_collection: data.needsPaymentOnCollection,
      is_bike_swap: data.isBikeSwap,
      delivery_instructions: data.deliveryInstructions,
      status: "created" as OrderStatus
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating order:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(order);
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

export const updateOrderStatus = async (
  id: string,
  status: OrderStatus
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

  return mapDbOrderToOrderType(data);
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
      status: "scheduled",
      scheduled_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating order scheduled dates:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};

// Alias for updateOrderScheduledDates to maintain compatibility with existing code
export const updateOrderSchedule = updateOrderScheduledDates;

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

  return mapDbOrderToOrderType(data);
};

export const updatePublicOrder = async (
  id: string,
  pickup_date: string[],
  status: OrderStatus
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

  return mapDbOrderToOrderType(data);
};

export const updateSenderAvailability = async (
  id: string, 
  dates: Date[]
): Promise<Order> => {
  const formattedDates = dates.map(date => date.toISOString());

  const { data, error } = await supabase
    .from("orders")
    .update({
      pickup_date: formattedDates,
      status: "sender_availability_confirmed" as OrderStatus,
      updated_at: new Date().toISOString(),
      sender_confirmed_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating sender availability:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};

export const updateReceiverAvailability = async (
  id: string, 
  dates: Date[]
): Promise<Order> => {
  const formattedDates = dates.map(date => date.toISOString());

  const { data, error } = await supabase
    .from("orders")
    .update({
      delivery_date: formattedDates,
      status: "pending_approval" as OrderStatus, // Set to pending_approval when receiver confirms
      updated_at: new Date().toISOString(),
      receiver_confirmed_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating receiver availability:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};

export const resendSenderAvailabilityEmail = async (id: string): Promise<boolean> => {
  // Implementation for resend email function
  
  // Return true to indicate success
  return true;
};
