
import { supabase } from "@/integrations/supabase/client";
import { Order, OrderStatus } from "@/types/order";
import { CreateOrderFormData } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";
import { sendOrderCreationEmailToSender, sendOrderNotificationToReceiver, resendReceiverAvailabilityEmail as resendReceiverAvailabilityEmailFunc, sendSenderAvailabilityEmail } from "@/services/emailService";
import { generateTrackingNumber } from "@/services/trackingService";

// For backward compatibility with fetchOrderService
export const getOrder = async (id: string): Promise<Order | null> => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching order:", error);
      return null;
    }

    return mapDbOrderToOrderType(data);
  } catch (error) {
    console.error("Unexpected error fetching order:", error);
    return null;
  }
};

// Alias for getOrder to maintain compatibility
export const getOrderById = getOrder;

export const getPublicOrder = async (id: string): Promise<Order | null> => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, bike_brand, bike_model, sender_notes, receiver_notes, pickup_date, delivery_date")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching public order:", error);
      return null;
    }

    return mapDbOrderToOrderType(data);
  } catch (error) {
    console.error("Unexpected error fetching public order:", error);
    return null;
  }
};

export const getOrders = async (): Promise<Order[]> => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*");

    if (error) {
      console.error("Error fetching orders:", error);
      return [];
    }

    return data.map(mapDbOrderToOrderType);
  } catch (error) {
    console.error("Unexpected error fetching orders:", error);
    return [];
  }
};

export const updateOrderStatus = async (id: string, status: OrderStatus): Promise<Order | null> => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating order status:", error);
      return null;
    }

    return mapDbOrderToOrderType(data);
  } catch (error) {
    console.error("Unexpected error updating order status:", error);
    return null;
  }
};

// Alias for updateOrderStatus for admin operations
export const updateAdminOrderStatus = updateOrderStatus;

export const createOrder = async (data: CreateOrderFormData): Promise<Order> => {
  try {
    const { sender, receiver, bikeBrand, bikeModel, customerOrderNumber, needsPaymentOnCollection, isBikeSwap, deliveryInstructions } = data;

    const {
      street: senderStreet,
      city: senderCity,
      state: senderState,
      zipCode: senderZipCode,
      country: senderCountry,
      lat: senderLat,
      lon: senderLon,
    } = sender.address;

    const {
      street: receiverStreet,
      city: receiverCity,
      state: receiverState,
      zipCode: receiverZipCode,
      country: receiverCountry,
      lat: receiverLat,
      lon: receiverLon,
    } = receiver.address;

    // Get current user ID from auth context
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Create timestamp for consistency
    const timestamp = new Date().toISOString();

    // Generate a tracking number using the edge function
    const trackingNumber = await generateTrackingNumber(sender.name, receiver.address.zipCode);

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        sender: {
          name: sender.name,
          email: sender.email,
          phone: sender.phone,
          address: {
            street: senderStreet,
            city: senderCity,
            state: senderState,
            zipCode: senderZipCode,
            country: senderCountry,
            lat: senderLat,
            lon: senderLon,
          },
        },
        receiver: {
          name: receiver.name,
          email: receiver.email,
          phone: receiver.phone,
          address: {
            street: receiverStreet,
            city: receiverCity,
            state: receiverState,
            zipCode: receiverZipCode,
            country: receiverCountry,
            lat: receiverLat,
            lon: receiverLon,
          },
        },
        bike_brand: bikeBrand,
        bike_model: bikeModel,
        customer_order_number: customerOrderNumber,
        needs_payment_on_collection: needsPaymentOnCollection,
        is_bike_swap: isBikeSwap,
        delivery_instructions: deliveryInstructions,
        status: "created",
        created_at: timestamp,
        updated_at: timestamp,
        tracking_number: trackingNumber, // Set the tracking number from the edge function
      })
      .select()
      .single();
    
    if (error) {
      console.error("Error creating order:", error);
      throw error;
    }
    
    // Guaranteed sequential email sending with detailed logs
    const sendEmails = async () => {
      try {
        console.log("===== STARTING EMAIL SENDING PROCESS =====");
        console.log(`Order ID: ${order.id}`);
        console.log(`Sender email: ${sender.email}`);
        console.log(`Receiver email: ${receiver.email}`);
        
        // First send order confirmation to sender with explicit awaiting
        console.log("STEP 1: Sending confirmation email to sender...");
        const senderEmailResult = await sendOrderCreationEmailToSender(order.id);
        console.log(`Sender confirmation email sent successfully: ${senderEmailResult}`);
        
        // Second, send sender availability email
        console.log("STEP 2: Sending availability email to sender...");
        const senderAvailabilityResult = await sendSenderAvailabilityEmail(order.id);
        console.log(`Sender availability email sent successfully: ${senderAvailabilityResult}`);
        
        // Then send to receiver only after sender emails complete
        console.log("STEP 3: Sending notification email to receiver...");
        const receiverEmailResult = await sendOrderNotificationToReceiver(order.id);
        console.log(`Receiver email sent successfully: ${receiverEmailResult}`);
        
        console.log("===== EMAIL SENDING PROCESS COMPLETED =====");
        return { 
          senderConfirmation: senderEmailResult, 
          senderAvailability: senderAvailabilityResult,
          receiver: receiverEmailResult 
        };
      } catch (emailError) {
        console.error("===== EMAIL SENDING PROCESS FAILED =====");
        console.error("Error details:", emailError);
        // Do not throw to prevent blocking the order creation
        return { 
          senderConfirmation: false, 
          senderAvailability: false,
          receiver: false, 
          error: emailError 
        };
      }
    };
    
    // Fire and forget, but with console tracking
    console.log("Starting email sending process in background");
    sendEmails().then(results => {
      console.log("Background email sending results:", results);
    }).catch(err => {
      console.error("Unexpected error in background email sending:", err);
    });
    
    return mapDbOrderToOrderType(order);
  } catch (error) {
    console.error("Error creating order:", error);
    throw error;
  }
};

// Add the missing functions required by the imports in other files
export const updateOrderSchedule = async (
  id: string,
  pickupDate: Date,
  deliveryDate: Date
): Promise<Order | null> => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .update({
        scheduled_pickup_date: pickupDate.toISOString(),
        scheduled_delivery_date: deliveryDate.toISOString(),
        status: "scheduled",
        scheduled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error scheduling order:", error);
      return null;
    }

    return mapDbOrderToOrderType(data);
  } catch (error) {
    console.error("Unexpected error scheduling order:", error);
    return null;
  }
};

// Function needed by schedulingService
export const updateOrderScheduledDates = async (
  id: string,
  pickupDate: Date,
  deliveryDate: Date
): Promise<Order | null> => {
  return updateOrderSchedule(id, pickupDate, deliveryDate);
};

export const resendSenderAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    return await resendSenderAvailabilityEmailFunc(id);
  } catch (error) {
    console.error("Error resending sender availability email:", error);
    return false;
  }
};

export const resendReceiverAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    return await resendReceiverAvailabilityEmailFunc(id);
  } catch (error) {
    console.error("Error resending receiver availability email:", error);
    return false;
  }
};

// Add polling functionality for real-time updates
export const pollOrderUpdates = (
  orderId: string, 
  callback: (order: Order) => void,
  interval: number = 10000
): () => void => {
  const intervalId = setInterval(async () => {
    try {
      const updatedOrder = await getOrder(orderId);
      if (updatedOrder) {
        callback(updatedOrder);
      }
    } catch (error) {
      console.error("Error polling for order updates:", error);
    }
  }, interval);

  // Return a cleanup function
  return () => clearInterval(intervalId);
};
