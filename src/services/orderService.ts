import { supabase } from "@/integrations/supabase/client";
import { Order, OrderStatus } from "@/types/order";
import { CreateOrderFormData } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";
import { 
  sendOrderCreationEmailToSender, 
  sendOrderNotificationToReceiver, 
  sendSenderAvailabilityEmail,
  sendReceiverAvailabilityEmail,
  sendDeliveryConfirmationEmails
} from "@/services/emailService";
import { generateTrackingNumber } from "@/services/trackingService";

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
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating order status:", error);
      return null;
    }
    
    // Handle status-specific actions
    if (status === "delivered") {
      // Send delivery confirmation emails when order is marked as delivered
      await sendDeliveryConfirmationEmails(id);
    } else if (status === "receiver_availability_pending") {
      // Send receiver availability email when status changes to receiver_availability_pending
      await sendReceiverAvailabilityEmail(id);
    }

    return mapDbOrderToOrderType(data);
  } catch (error) {
    console.error("Unexpected error updating order status:", error);
    return null;
  }
};

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    const timestamp = new Date().toISOString();

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
        status: "sender_availability_pending", // Ensure this is the correct initial status
        created_at: timestamp,
        updated_at: timestamp,
        tracking_number: trackingNumber,
      })
      .select()
      .single();
    
    if (error) {
      console.error("Error creating order:", error);
      throw error;
    }
    
    // Process emails synchronously to ensure proper sequence
    try {
      console.log("===== STARTING EMAIL SENDING PROCESS =====");
      console.log(`Order ID: ${order.id}`);
      
      // Step 1: Send order creation confirmation to sender
      console.log("STEP 1: Sending confirmation email to sender...");
      const senderEmailResult = await sendOrderCreationEmailToSender(order.id);
      console.log(`Sender confirmation email sent successfully: ${senderEmailResult}`);
      
      // Step 2: Send availability email to sender
      console.log("STEP 2: Sending availability email to sender...");
      const senderAvailabilityResult = await sendSenderAvailabilityEmail(order.id);
      console.log(`Sender availability email sent successfully: ${senderAvailabilityResult}`);
      
      // Step 3: Send notification to receiver
      console.log("STEP 3: Sending notification email to receiver...");
      const receiverEmailResult = await sendOrderNotificationToReceiver(order.id);
      console.log(`Receiver email sent successfully: ${receiverEmailResult}`);
      
      console.log("===== EMAIL SENDING PROCESS COMPLETED =====");
    } catch (emailError) {
      console.error("===== EMAIL SENDING PROCESS FAILED =====");
      console.error("Error details:", emailError);
      // Continue with order creation even if emails fail
      console.log("Continuing with order creation despite email failure");
    }
    
    return mapDbOrderToOrderType(order);
  } catch (error) {
    console.error("Error creating order:", error);
    throw error;
  }
};

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

export const updateOrderScheduledDates = async (
  id: string,
  pickupDate: Date,
  deliveryDate: Date
): Promise<Order | null> => {
  return updateOrderSchedule(id, pickupDate, deliveryDate);
};

export { resendSenderAvailabilityEmail, resendReceiverAvailabilityEmail };

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

  return () => clearInterval(intervalId);
};

export const resendSenderAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    console.log("Resending sender availability email for order ID:", id);
    return await sendSenderAvailabilityEmail(id);
  } catch (error) {
    console.error("Error resending sender availability email:", error);
    return false;
  }
};

export const resendReceiverAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    console.log("Resending receiver availability email for order ID:", id);
    return await sendReceiverAvailabilityEmail(id);
  } catch (error) {
    console.error("Error resending receiver availability email:", error);
    return false;
  }
};
