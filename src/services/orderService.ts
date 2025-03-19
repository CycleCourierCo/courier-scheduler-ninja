import { supabase } from "@/integrations/supabase/client";
import { Order, CreateOrderFormData, OrderStatus, ContactInfo, Address } from "@/types/order";

// Helper function to map database schema to our Order type
const mapDbOrderToOrderType = (dbOrder: any): Order => {
  return {
    id: dbOrder.id,
    user_id: dbOrder.user_id,
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
    deliveryInstructions: dbOrder.delivery_instructions,
    trackingEvents: dbOrder.tracking_events // Add the tracking events field
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

  const userId = session.session.user.id;

  // Create the order in the database
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
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

  // Send email to sender after order creation
  try {
    const baseUrl = window.location.origin;
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: data.sender.email,
        name: data.sender.name,
        orderId: order.id,
        baseUrl,
        emailType: "sender" 
      }
    });
    
    if (response.error) {
      console.error("Error sending email:", response.error);
    } else {
      console.log("Email sent successfully to sender:", data.sender.email);
    }
  } catch (emailError) {
    console.error("Failed to send email:", emailError);
    // Don't throw here - we don't want to fail the order creation if email fails
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
      status: "receiver_availability_pending" as OrderStatus,
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

  // Get the order details to send email to receiver
  try {
    // After sender confirms availability, send email to the receiver
    const baseUrl = window.location.origin;
    
    // Ensure receiver data is properly typed and accessible
    const receiverData = data.receiver as unknown as ContactInfo & { address: Address };
    
    // Validate receiver email before sending
    if (!receiverData?.email) {
      console.error("Receiver email not found in order data:", data.receiver);
      throw new Error("Receiver email not found");
    }
    
    console.log("Sending email to receiver:", receiverData.email);
    
    // Send email to receiver with improved error handling
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: receiverData.email,
        name: receiverData.name || "Recipient",
        orderId: id,
        baseUrl,
        emailType: "receiver" 
      }
    });
    
    if (response.error) {
      console.error("Error sending email to receiver:", response.error);
      // Log detailed error information for debugging
      if (response.error.message) {
        console.error("Error message:", response.error.message);
      }
    } else {
      console.log("Email sent successfully to receiver:", receiverData.email);
    }
  } catch (emailError) {
    console.error("Failed to send email to receiver:", emailError);
    console.error("Error details:", emailError instanceof Error ? emailError.message : emailError);
    // Don't throw here - we don't want to fail the order update if email fails
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
      status: "receiver_availability_confirmed" as OrderStatus,
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
  try {
    // Get the order details first
    const order = await getOrder(id);
    
    // Ensure the order exists and has a sender
    if (!order || !order.sender || !order.sender.email) {
      console.error("Order or sender information not found");
      return false;
    }
    
    const baseUrl = window.location.origin;
    
    // Send email to sender with improved error handling
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: order.sender.email,
        name: order.sender.name || "Sender",
        orderId: id,
        baseUrl,
        emailType: "sender" 
      }
    });
    
    if (response.error) {
      console.error("Error resending email to sender:", response.error);
      return false;
    }
    
    console.log("Email resent successfully to sender:", order.sender.email);
    return true;
  } catch (error) {
    console.error("Failed to resend email:", error);
    return false;
  }
};
