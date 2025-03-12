import { Order, CreateOrderFormData, OrderStatus, ContactInfo, Address } from "@/types/order";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

// Type guard to check if a value is a ContactInfo with address
function isContactWithAddress(value: any): value is ContactInfo & { address: Address } {
  return (
    value &&
    typeof value === 'object' &&
    'name' in value &&
    'email' in value &&
    'phone' in value &&
    'address' in value &&
    typeof value.address === 'object' &&
    'street' in value.address &&
    'city' in value.address &&
    'state' in value.address &&
    'zipCode' in value.address &&
    'country' in value.address
  );
}

// Convert Json to ContactInfo & { address: Address }
function convertJsonToContact(json: Json): ContactInfo & { address: Address } {
  if (isContactWithAddress(json)) {
    return json;
  }
  
  // This should not happen in practice, but we need to handle it for TypeScript
  console.error("Invalid contact info format:", json);
  return {
    name: "",
    email: "",
    phone: "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: ""
    }
  };
}

// Helper function to safely convert JSON pickup/delivery dates to Date objects
function convertJsonToDateOrDates(json: Json | null): Date | Date[] | undefined {
  if (!json) return undefined;
  
  if (Array.isArray(json)) {
    // Filter out any non-string values and convert to Date objects
    return json
      .filter(item => typeof item === 'string')
      .map(dateStr => new Date(dateStr as string));
  }
  
  if (typeof json === 'string') {
    return new Date(json);
  }
  
  return undefined;
}

// Send email to sender for availability confirmation
const sendSenderAvailabilityEmail = async (order: Order): Promise<void> => {
  try {
    // Get the base URL for the frontend
    const baseUrl = window.location.origin;
    
    // Add better error handling for the Edge Function call
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: order.sender.email,
          name: order.sender.name,
          orderId: order.id,
          baseUrl,
          emailType: "sender"
        }
      });
      
      if (error) {
        throw new Error(`Edge Function error: ${error.message}`);
      }
      
      console.log("Email sent to sender for availability confirmation");
    } catch (functionError) {
      // Handle specific edge function errors
      console.error("Failed to call Edge Function:", functionError);
      throw new Error("Failed to send a request to the Edge Function");
    }
  } catch (error) {
    console.error("Error sending email:", error);
    // Re-throw the error so it can be handled by the calling function
    throw error;
  }
};

// Send email to receiver for availability confirmation
const sendReceiverAvailabilityEmail = async (order: Order): Promise<void> => {
  try {
    // Get the base URL for the frontend
    const baseUrl = window.location.origin;
    
    // Add better error handling for the Edge Function call
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: order.receiver.email,
          name: order.receiver.name,
          orderId: order.id,
          baseUrl,
          emailType: "receiver"
        }
      });
      
      if (error) {
        throw new Error(`Edge Function error: ${error.message}`);
      }
      
      console.log("Email sent to receiver for availability confirmation");
    } catch (functionError) {
      // Handle specific edge function errors
      console.error("Failed to call Edge Function:", functionError);
      throw new Error("Failed to send a request to the Edge Function");
    }
  } catch (error) {
    console.error("Error sending email:", error);
    // Re-throw the error so it can be handled by the calling function
    throw error;
  }
};

// Resend sender availability email for a specific order
export const resendSenderAvailabilityEmail = async (orderId: string): Promise<boolean> => {
  try {
    const order = await getOrderById(orderId);
    
    if (!order) {
      throw new Error(`Order with ID ${orderId} not found`);
    }
    
    if (order.status !== 'sender_availability_pending') {
      throw new Error(`Cannot resend email for order with status ${order.status}`);
    }
    
    await sendSenderAvailabilityEmail(order);
    toast.success(`Email resent to ${order.sender.email} successfully`);
    return true;
  } catch (error) {
    console.error("Error resending email:", error);
    toast.error(`Failed to resend email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

// Resend receiver availability email for a specific order
export const resendReceiverAvailabilityEmail = async (orderId: string): Promise<boolean> => {
  try {
    const order = await getOrderById(orderId);
    
    if (!order) {
      throw new Error(`Order with ID ${orderId} not found`);
    }
    
    if (order.status !== 'receiver_availability_pending') {
      throw new Error(`Cannot resend email for order with status ${order.status}`);
    }
    
    await sendReceiverAvailabilityEmail(order);
    toast.success(`Email resent to ${order.receiver.email} successfully`);
    return true;
  } catch (error) {
    console.error("Error resending email:", error);
    toast.error(`Failed to resend email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

// Create a new order
export const createOrder = async (data: CreateOrderFormData): Promise<Order> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const newOrder = {
      user_id: user.id,
      sender: data.sender,
      receiver: data.receiver,
      status: 'sender_availability_pending' as OrderStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    // Store the order in Supabase
    const { data: order, error } = await supabase
      .from('orders')
      .insert(newOrder)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    // Simulate sending email to sender
    console.log(`Email sent to sender ${data.sender.email} for order ${order.id}`);
    toast.info(`Email sent to sender: ${data.sender.email}`);
    
    const createdOrder = {
      id: order.id,
      sender: convertJsonToContact(order.sender),
      receiver: convertJsonToContact(order.receiver),
      status: order.status as OrderStatus,
      createdAt: new Date(order.created_at),
      updatedAt: new Date(order.updated_at),
      pickupDate: convertJsonToDateOrDates(order.pickup_date),
      deliveryDate: convertJsonToDateOrDates(order.delivery_date),
      trackingNumber: order.tracking_number
    };
    
    // Send email to sender for availability confirmation
    await sendSenderAvailabilityEmail(createdOrder);
    
    return createdOrder;
  } catch (error) {
    console.error("Error creating order:", error);
    throw new Error("Failed to create order");
  }
};

// Get all orders
export const getOrders = async (): Promise<Order[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error("User not authenticated");
    }
    
    const { data: ordersData, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    return ordersData.map(order => ({
      id: order.id,
      sender: convertJsonToContact(order.sender),
      receiver: convertJsonToContact(order.receiver),
      status: order.status as OrderStatus,
      createdAt: new Date(order.created_at),
      updatedAt: new Date(order.updated_at),
      pickupDate: convertJsonToDateOrDates(order.pickup_date),
      deliveryDate: convertJsonToDateOrDates(order.delivery_date),
      trackingNumber: order.tracking_number
    }));
  } catch (error) {
    console.error("Error fetching orders:", error);
    throw new Error("Failed to fetch orders");
  }
};

// Get order by ID
export const getOrderById = async (id: string): Promise<Order | undefined> => {
  try {
    console.log(`Fetching order with ID: ${id}`);
    
    // Check if the ID is in the correct format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      console.error(`Invalid UUID format: ${id}`);
      return undefined;
    }
    
    // Simplified approach: Just fetch the full order in one query 
    // without doing a separate existence check first
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) {
      console.error(`Error fetching order data: ${error.message}`, error);
      throw error;
    }
    
    console.log("Order data received:", order);
    
    if (!order) {
      console.log(`No order found with ID: ${id}`);
      return undefined;
    }
    
    return {
      id: order.id,
      sender: convertJsonToContact(order.sender),
      receiver: convertJsonToContact(order.receiver),
      status: order.status as OrderStatus,
      createdAt: new Date(order.created_at),
      updatedAt: new Date(order.updated_at),
      pickupDate: convertJsonToDateOrDates(order.pickup_date),
      deliveryDate: convertJsonToDateOrDates(order.delivery_date),
      trackingNumber: order.tracking_number
    };
  } catch (error) {
    console.error("Error fetching order:", error);
    throw new Error("Failed to fetch order");
  }
};

// Update order status
export const updateOrderStatus = async (id: string, status: OrderStatus): Promise<Order | undefined> => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .update({ 
        status, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return order ? {
      id: order.id,
      sender: convertJsonToContact(order.sender),
      receiver: convertJsonToContact(order.receiver),
      status: order.status as OrderStatus,
      createdAt: new Date(order.created_at),
      updatedAt: new Date(order.updated_at),
      pickupDate: convertJsonToDateOrDates(order.pickup_date),
      deliveryDate: convertJsonToDateOrDates(order.delivery_date),
      trackingNumber: order.tracking_number
    } : undefined;
  } catch (error) {
    console.error("Error updating order status:", error);
    throw new Error("Failed to update order status");
  }
};

// Update sender availability
export const updateSenderAvailability = async (id: string, pickupDates: Date | Date[]): Promise<Order | undefined> => {
  try {
    // Make sure we have an array of dates
    const datesArray = Array.isArray(pickupDates) ? pickupDates : [pickupDates];
    
    // Convert all dates to ISO strings
    const pickupDatesISO = datesArray.map(date => date.toISOString());
    
    console.log(`Updating order ${id} with pickup dates:`, pickupDatesISO);
    
    // First, verify the order exists
    const { data: existingOrder, error: existingError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
      
    if (existingError) {
      console.error(`Error checking if order exists: ${existingError.message}`, existingError);
      throw existingError;
    }
    
    if (!existingOrder) {
      console.error(`Order with ID ${id} does not exist`);
      throw new Error(`Order not found with ID: ${id}`);
    }
    
    // Now update the order with the new pickup dates
    const { data: order, error } = await supabase
      .from('orders')
      .update({ 
        pickup_date: pickupDatesISO,
        status: 'receiver_availability_pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    
    if (error) {
      console.error(`Error updating sender availability: ${error.message}`, error);
      throw error;
    }
    
    if (!order) {
      console.error(`No order returned after update for ID: ${id}`);
      throw new Error("Order not found after update");
    }
    
    // Convert the order to our expected format
    const updatedOrder = {
      id: order.id,
      sender: convertJsonToContact(order.sender),
      receiver: convertJsonToContact(order.receiver),
      status: order.status as OrderStatus,
      createdAt: new Date(order.created_at),
      updatedAt: new Date(order.updated_at),
      pickupDate: convertJsonToDateOrDates(order.pickup_date),
      deliveryDate: convertJsonToDateOrDates(order.delivery_date),
      trackingNumber: order.tracking_number
    };
    
    // Send email to receiver if order was updated successfully
    try {
      await sendReceiverAvailabilityEmail(updatedOrder);
      console.log(`Email sent to receiver ${updatedOrder.receiver.email} for order ${id}`);
      toast.info(`Email sent to receiver: ${updatedOrder.receiver.email}`);
    } catch (emailError) {
      console.error("Error sending email to receiver:", emailError);
      toast.error("Failed to send email to receiver. They will need to be notified manually.");
      // Don't throw here - we still want to return the updated order even if email fails
    }
    
    return updatedOrder;
  } catch (error) {
    console.error("Error updating sender availability:", error);
    throw error; // Propagate the error to be handled by the caller
  }
};

// Update receiver availability
export const updateReceiverAvailability = async (id: string, deliveryDates: Date | Date[]): Promise<Order | undefined> => {
  try {
    // Make sure we have an array of dates
    const datesArray = Array.isArray(deliveryDates) ? deliveryDates : [deliveryDates];
    
    // Convert all dates to ISO strings
    const deliveryDatesISO = datesArray.map(date => date.toISOString());
    
    // First update the order with delivery date and scheduled status
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ 
        delivery_date: deliveryDatesISO,
        status: 'scheduled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      throw updateError;
    }
    
    // Simulate creating Shipday order
    try {
      const trackingNumber = await createShipdayOrder(updatedOrder);
      
      // Update the order with tracking number and shipped status
      const { data: shippedOrder, error: shippedError } = await supabase
        .from('orders')
        .update({
          tracking_number: trackingNumber,
          status: 'shipped',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
        
      if (shippedError) {
        throw shippedError;
      }
      
      toast.success(`Order has been shipped with tracking number: ${trackingNumber}`);
      
      return shippedOrder ? {
        id: shippedOrder.id,
        sender: convertJsonToContact(shippedOrder.sender),
        receiver: convertJsonToContact(shippedOrder.receiver),
        status: shippedOrder.status as OrderStatus,
        createdAt: new Date(shippedOrder.created_at),
        updatedAt: new Date(shippedOrder.updated_at),
        pickupDate: convertJsonToDateOrDates(shippedOrder.pickup_date),
        deliveryDate: convertJsonToDateOrDates(shippedOrder.delivery_date),
        trackingNumber: shippedOrder.tracking_number
      } : undefined;
    } catch (error) {
      console.error("Error creating Shipday order:", error);
      toast.error("Failed to create Shipday order");
      
      return updatedOrder ? {
        id: updatedOrder.id,
        sender: convertJsonToContact(updatedOrder.sender),
        receiver: convertJsonToContact(updatedOrder.receiver),
        status: updatedOrder.status as OrderStatus,
        createdAt: new Date(updatedOrder.created_at),
        updatedAt: new Date(updatedOrder.updated_at),
        pickupDate: convertJsonToDateOrDates(updatedOrder.pickup_date),
        deliveryDate: convertJsonToDateOrDates(updatedOrder.delivery_date),
        trackingNumber: updatedOrder.tracking_number
      } : undefined;
    }
  } catch (error) {
    console.error("Error updating receiver availability:", error);
    throw new Error("Failed to update receiver availability");
  }
};

// Create Shipday order
const createShipdayOrder = async (order: any): Promise<string> => {
  // Simulating Shipday API call
  console.log("Creating Shipday order with data:", order);
  
  // For now, we'll just return a mock tracking number
  return `SD-${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
};
